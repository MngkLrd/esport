#!/usr/bin/env python3
from __future__ import annotations

import argparse
import bisect
import datetime as dt
import json
import math
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parents[1]
API_BASE = "https://api.csapi.de"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build 12-month player-card snapshots from HLTV-derived match stats.")
    p.add_argument("--start-date", required=True)
    p.add_argument("--end-date", required=True)
    p.add_argument("--output", default="src/hltvCardStats.generated.ts")
    p.add_argument("--report", default="data/hltv-card-report.json")
    return p.parse_args()


def repo_aliases() -> list[str]:
    players = (ROOT / "src/players.ts").read_text(encoding="utf-8")
    vrs = (ROOT / "src/vrs.ts").read_text(encoding="utf-8")
    curated = players.split("const CURATED_REAL_PLAYERS", 1)[1].split("] as const", 1)[0]
    curated_aliases = re.findall(r"alias:\s*'([^']+)'", curated)
    vrs_block = vrs.split("export const VRS_PLAYERS", 1)[1].split("export const VRS_STATS", 1)[0]
    vrs_aliases = re.findall(r'alias:\s*"([^"]+)"', vrs_block)

    out: list[str] = []
    seen: set[str] = set()
    for alias in [*curated_aliases, *vrs_aliases]:
        key = alias.casefold()
        if key not in seen:
            seen.add(key)
            out.append(alias)
    return out


def metadata_profile_ids() -> dict[str, int]:
    text = (ROOT / "src/playerMetadata.ts").read_text(encoding="utf-8")
    out: dict[str, int] = {}
    for match in re.finditer(r'^\s*"([^"]+)":\s*\{([^\n]+)\}', text, re.M):
        alias, body = match.groups()
        url_match = re.search(r'profileUrl:"([^"]+)"', body)
        if not url_match:
            continue
        id_match = re.search(r'/(?:player|stats/players)/(\d+)(?:/|$)', url_match.group(1))
        if id_match:
            out[alias.casefold()] = int(id_match.group(1))
    return out


def get_json(path: str, params: dict[str, Any]) -> Any:
    response = requests.get(
        API_BASE + path,
        params=params,
        timeout=60,
        headers={"User-Agent": "esport-ai-manager/0.3 (+https://github.com/MngkLrd/esport)"},
    )
    response.raise_for_status()
    return response.json()


def as_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def percentile(values: list[float], value: float, higher_is_better: bool = True) -> float:
    if len(values) <= 1:
        return 0.5
    ordered = sorted(values)
    left = bisect.bisect_left(ordered, value)
    right = bisect.bisect_right(ordered, value)
    midpoint = (left + right - 1) / 2
    p = midpoint / (len(ordered) - 1)
    return p if higher_is_better else 1.0 - p


def to_card_scale(p: float) -> float:
    return 22.0 + max(0.0, min(1.0, p)) * 77.0


def stabilize(score: float, maps: int) -> int:
    confidence = min(1.0, math.sqrt(max(0, maps) / 50.0))
    return int(round(max(1.0, min(99.0, 50.0 + (score - 50.0) * confidence))))


def weighted(parts: list[tuple[float, float]]) -> float:
    total = sum(weight for _, weight in parts)
    return sum(value * weight for value, weight in parts) / total if total else 50.0


def empty_snapshot(alias: str, player_id: int | None, start_date: str, end_date: str, status: str) -> dict[str, Any]:
    return {
        "alias": alias,
        "playerId": player_id,
        "profileUrl": f"https://www.hltv.org/player/{player_id}/{quote(alias)}" if player_id else None,
        "status": status,
        "window": "year",
        "periodStart": start_date,
        "periodEnd": end_date,
        "raw": {
            "maps": 0,
            "rating": None,
            "adr": None,
            "kast": None,
            "roundSwing": None,
            "killsPerMap": None,
            "deathsPerMap": None,
        },
        "cardScores": None,
    }


def main() -> None:
    args = parse_args()
    aliases = repo_aliases()
    known_ids = metadata_profile_ids()

    rows = get_json("/players/stats", {
        "mapid": 0,
        "sideid": 0,
        "start_date": args.start_date,
        "end_date": args.end_date,
        "limit": 5000,
        "offset": 0,
        "min_played": 1,
    })
    if not isinstance(rows, list):
        raise RuntimeError("Unexpected /players/stats payload")
    if len(rows) < 100:
        raise RuntimeError(f"Coverage gate failed: API returned only {len(rows)} active players")

    by_alias: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict) or not row.get("name"):
            continue
        key = str(row["name"]).casefold()
        # Keep the row with the larger sample if duplicate aliases exist.
        if key not in by_alias or int(row.get("N") or 0) > int(by_alias[key].get("N") or 0):
            by_alias[key] = row

    population = list(by_alias.values())
    rating_values = [float(r["rating"]) for r in population if as_float(r.get("rating")) is not None]
    adr_values = [float(r["adr"]) for r in population if as_float(r.get("adr")) is not None]
    kast_values = [float(r["kast"]) for r in population if as_float(r.get("kast")) is not None]
    swing_values = [float(r["swing"]) for r in population if as_float(r.get("swing")) is not None]
    kills_map_values = [
        float(r["k"]) / max(1, int(r.get("N") or 0))
        for r in population if as_float(r.get("k")) is not None and int(r.get("N") or 0) > 0
    ]
    deaths_map_values = [
        float(r["d"]) / max(1, int(r.get("N") or 0))
        for r in population if as_float(r.get("d")) is not None and int(r.get("N") or 0) > 0
    ]

    snapshots: dict[str, dict[str, Any]] = {}
    for alias in aliases:
        key = alias.casefold()
        row = by_alias.get(key)
        if row is None:
            player_id = known_ids.get(key)
            snapshots[key] = empty_snapshot(
                alias, player_id, args.start_date, args.end_date,
                "no-data" if player_id is not None else "unmatched",
            )
            continue

        player_id = int(row["id"])
        maps = int(row.get("N") or 0)
        rating = as_float(row.get("rating"))
        adr = as_float(row.get("adr"))
        kast = as_float(row.get("kast"))
        swing = as_float(row.get("swing"))
        kills_per_map = (as_float(row.get("k")) or 0.0) / max(1, maps)
        deaths_per_map = (as_float(row.get("d")) or 0.0) / max(1, maps)

        if None in (rating, adr, kast, swing) or maps <= 0:
            snapshots[key] = empty_snapshot(alias, player_id, args.start_date, args.end_date, "no-data")
            continue

        p_rating = to_card_scale(percentile(rating_values, rating))
        p_adr = to_card_scale(percentile(adr_values, adr))
        p_kast = to_card_scale(percentile(kast_values, kast))
        p_swing = to_card_scale(percentile(swing_values, swing))
        p_kills = to_card_scale(percentile(kills_map_values, kills_per_map))
        p_survival = to_card_scale(percentile(deaths_map_values, deaths_per_map, higher_is_better=False))

        aim = stabilize(weighted([(p_adr, .45), (p_kills, .35), (p_rating, .20)]), maps)
        utility = stabilize(weighted([(p_kast, .62), (p_swing, .38)]), maps)
        positioning = stabilize(weighted([(p_kast, .45), (p_survival, .35), (p_swing, .20)]), maps)
        clutch = stabilize(weighted([(p_rating, .45), (p_swing, .35), (p_survival, .20)]), maps)

        snapshots[key] = {
            "alias": alias,
            "playerId": player_id,
            "profileUrl": f"https://www.hltv.org/player/{player_id}/{quote(alias)}",
            "status": "ok",
            "window": "year",
            "periodStart": args.start_date,
            "periodEnd": args.end_date,
            "raw": {
                "maps": maps,
                "rating": round(rating, 3),
                "adr": round(adr, 3),
                "kast": round(kast, 3),
                "roundSwing": round(swing, 3),
                "killsPerMap": round(kills_per_map, 3),
                "deathsPerMap": round(deaths_per_map, 3),
            },
            "cardScores": {
                "aim": aim,
                "utility": utility,
                "positioning": positioning,
                "clutch": clutch,
            },
        }

    with_stats = sum(1 for s in snapshots.values() if s["status"] == "ok")
    no_data = sum(1 for s in snapshots.values() if s["status"] == "no-data")
    unmatched = sum(1 for s in snapshots.values() if s["status"] == "unmatched")

    meta = {
        "source": "HLTV-derived match statistics",
        "provider": "api.csapi.de",
        "window": "year",
        "windowLabel": "Last 12 months",
        "startDate": args.start_date,
        "endDate": args.end_date,
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "requestedPlayers": len(aliases),
        "providerActivePlayers": len(rows),
        "matchedProfiles": with_stats + no_data,
        "withStats": with_stats,
        "noData": no_data,
        "unmatched": unmatched,
        "errors": 0,
    }
    if with_stats < 100:
        raise RuntimeError(f"Repo coverage gate failed: only {with_stats}/{len(aliases)} requested players have stats")

    ts_rows = [
        f"  {json.dumps(key)}: {json.dumps(snapshots[key], ensure_ascii=False, separators=(',', ':'))},"
        for key in sorted(snapshots)
    ]
    output_text = (
        "// AUTO-GENERATED by scripts/update-hltv-card-stats.py. DO NOT EDIT.\n"
        "import type { HltvPlayerSnapshot } from './cardStats'\n\n"
        f"export const HLTV_CARD_SNAPSHOT_META = {json.dumps(meta, ensure_ascii=False, separators=(',', ':'))} as const\n\n"
        "export const HLTV_CARD_SNAPSHOTS: Readonly<Record<string, HltvPlayerSnapshot>> = {\n"
        + "\n".join(ts_rows)
        + "\n}\n"
    )

    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(output_text, encoding="utf-8")

    report = ROOT / args.report
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        "meta": meta,
        "noDataAliases": sorted(s["alias"] for s in snapshots.values() if s["status"] == "no-data"),
        "unmatchedAliases": sorted(s["alias"] for s in snapshots.values() if s["status"] == "unmatched"),
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(meta, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
