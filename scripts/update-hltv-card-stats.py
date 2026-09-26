#!/usr/bin/env python3
from __future__ import annotations

import argparse
import bisect
import datetime as dt
import json
import math
import random
import re
import time
import unicodedata
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parents[1]
API_BASE = "https://api.csapi.de"
DIRECT_HLTV_SNAPSHOT = ROOT / "data/hltv-mobile-player-screen-2026-09-26.json"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build collectible cards from HLTV player and match statistics.")
    p.add_argument("--start-date", required=True)
    p.add_argument("--end-date", required=True)
    p.add_argument("--oldest-year", type=int, default=2012)
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
        url_match = re.search(r'"profileUrl"\s*:\s*"([^"]+)"', body)
        if not url_match:
            continue
        id_match = re.search(r'/(?:player|stats/players)/(\d+)(?:/|$)', url_match.group(1))
        if id_match:
            out[alias.casefold()] = int(id_match.group(1))
    return out


def direct_hltv_players() -> dict[str, dict[str, Any]]:
    if not DIRECT_HLTV_SNAPSHOT.exists():
        return {}
    payload = json.loads(DIRECT_HLTV_SNAPSHOT.read_text(encoding="utf-8"))
    players = payload.get("players") if isinstance(payload, dict) else None
    if not isinstance(players, dict):
        return {}
    return {
        str(key).casefold(): value
        for key, value in players.items()
        if isinstance(value, dict)
    }


def normalized_alias(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return "".join(ch for ch in ascii_value.casefold() if ch.isalnum())


def get_json(path: str, params: dict[str, Any]) -> Any:
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            response = requests.get(
                API_BASE + path,
                params=params,
                timeout=60,
                headers={"User-Agent": "esport-ai-manager/0.3 (+https://github.com/MngkLrd/esport)"},
            )
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt == 4:
                break
            time.sleep(min(8.0, 0.8 * (2 ** attempt) + random.uniform(0.1, 0.5)))
    raise RuntimeError(str(last_error) if last_error else f"Unable to fetch {path}")


def fetch_population(start_date: str, end_date: str) -> list[dict[str, Any]]:
    page_size = 250
    offset = 0
    rows: list[dict[str, Any]] = []
    while True:
        page = get_json("/players/stats", {
            "mapid": 0,
            "sideid": 0,
            "start_date": start_date,
            "end_date": end_date,
            "limit": page_size,
            "offset": offset,
            "min_played": 1,
        })
        if not isinstance(page, list):
            raise RuntimeError("Unexpected /players/stats payload")
        rows.extend(row for row in page if isinstance(row, dict))
        print(f"{start_date}..{end_date} offset={offset}: {len(page)} rows", flush=True)
        if len(page) < page_size:
            break
        offset += page_size
        if offset > 10000:
            raise RuntimeError("Pagination safety limit exceeded")
    return rows


def as_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    try:
        return int(value)
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


def weighted(parts: list[tuple[float | None, float]], fallback: float = 50.0) -> float:
    present = [(value, weight) for value, weight in parts if value is not None]
    total = sum(weight for _, weight in present)
    return sum(float(value) * weight for value, weight in present) / total if total else fallback


def score_population(rows: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    valid = [
        r for r in rows
        if int(r.get("N") or 0) > 0
        and all(as_float(r.get(field)) is not None for field in ("rating", "adr", "kast", "swing", "k", "d"))
    ]
    if not valid:
        return {}

    rating_values = [float(r["rating"]) for r in valid]
    adr_values = [float(r["adr"]) for r in valid]
    kast_values = [float(r["kast"]) for r in valid]
    swing_values = [float(r["swing"]) for r in valid]
    kills_map_values = [float(r["k"]) / int(r["N"]) for r in valid]
    deaths_map_values = [float(r["d"]) / int(r["N"]) for r in valid]

    result: dict[int, dict[str, Any]] = {}
    for row in valid:
        maps = int(row["N"])
        rating = float(row["rating"])
        adr = float(row["adr"])
        kast = float(row["kast"])
        swing = float(row["swing"])
        kills_per_map = float(row["k"]) / maps
        deaths_per_map = float(row["d"]) / maps

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

        result[int(row["id"])] = {
            **row,
            "_raw": {
                "maps": maps,
                "rating": round(rating, 3),
                "adr": round(adr, 3),
                "kast": round(kast, 3),
                "roundSwing": round(swing, 3),
                "killsPerMap": round(kills_per_map, 3),
                "deathsPerMap": round(deaths_per_map, 3),
            },
            "_cardScores": {
                "aim": aim,
                "utility": utility,
                "positioning": positioning,
                "clutch": clutch,
            },
        }
    return result


def match_row(
    alias: str,
    known_id: int | None,
    scored: dict[int, dict[str, Any]],
) -> tuple[dict[str, Any] | None, str | None]:
    if known_id is not None and known_id in scored:
        return scored[known_id], "hltv-id"

    exact = [row for row in scored.values() if str(row.get("name", "")).casefold() == alias.casefold()]
    if len(exact) == 1:
        return exact[0], "exact-alias"

    target = normalized_alias(alias)
    normalized = [row for row in scored.values() if normalized_alias(str(row.get("name", ""))) == target]
    if target and len(normalized) == 1:
        return normalized[0], "normalized-alias"

    return None, None


def snapshot_from_row(
    alias: str,
    row: dict[str, Any],
    match_method: str,
    start_date: str,
    end_date: str,
    window: str,
) -> dict[str, Any]:
    player_id = int(row["id"])
    return {
        "alias": alias,
        "playerId": player_id,
        "profileUrl": f"https://www.hltv.org/player/{player_id}/{quote(alias)}",
        "status": "ok",
        "matchMethod": match_method,
        "scoreSource": "hltv-match-derived",
        "window": window,
        "periodStart": start_date,
        "periodEnd": end_date,
        "raw": row["_raw"],
        "cardScores": row["_cardScores"],
    }


def snapshot_from_direct(alias: str, row: dict[str, Any]) -> dict[str, Any] | None:
    if row.get("status") != "ok":
        return None
    skills = row.get("skills")
    if not isinstance(skills, dict):
        return None

    firepower = as_float(skills.get("firepower"))
    utility = as_float(skills.get("utility"))
    clutching = as_float(skills.get("clutching"))
    trading = as_float(skills.get("trading"))
    opening = as_float(skills.get("opening"))
    entrying = as_float(skills.get("entrying"))
    populated = sum(value is not None for value in (firepower, utility, clutching, trading, opening, entrying))
    if populated < 5:
        return None

    positioning = int(round(weighted([
        (trading, .40),
        (opening, .35),
        (entrying, .25),
    ])))

    return {
        "alias": alias,
        "playerId": as_int(row.get("playerId")),
        "profileUrl": row.get("profileUrl"),
        "status": "ok",
        "matchMethod": "hltv-player-screen",
        "scoreSource": "hltv-player-screen",
        "window": "past3m",
        "periodStart": str(row.get("periodStart") or "2026-06-26"),
        "periodEnd": str(row.get("periodEnd") or "2026-09-26"),
        "raw": {
            "maps": None,
            "rating": as_float(row.get("rating")),
            "adr": as_float(row.get("adr")),
            "kast": as_float(row.get("kast")),
            "roundSwing": None,
            "killsPerMap": None,
            "deathsPerMap": None,
        },
        "cardScores": {
            "aim": int(round(firepower if firepower is not None else 50)),
            "utility": int(round(utility if utility is not None else 50)),
            "positioning": max(1, min(99, positioning)),
            "clutch": int(round(clutching if clutching is not None else 50)),
        },
    }


def empty_snapshot(
    alias: str,
    player_id: int | None,
    start_date: str,
    end_date: str,
    status: str,
) -> dict[str, Any]:
    return {
        "alias": alias,
        "playerId": player_id,
        "profileUrl": f"https://www.hltv.org/player/{player_id}/{quote(alias)}" if player_id else None,
        "status": status,
        "matchMethod": "hltv-id" if player_id else None,
        "scoreSource": None,
        "window": "last12m",
        "periodStart": start_date,
        "periodEnd": end_date,
        "raw": {
            "maps": None,
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
    metadata_ids = metadata_profile_ids()
    direct = direct_hltv_players()

    known_ids = {
        key: player_id
        for key, row in direct.items()
        if (player_id := as_int(row.get("playerId"))) is not None
    }
    known_ids.update(metadata_ids)

    snapshots: dict[str, dict[str, Any]] = {}
    remaining = {alias.casefold(): alias for alias in aliases}

    direct_matches = 0
    for key, alias in list(remaining.items()):
        row = direct.get(key)
        snapshot = snapshot_from_direct(alias, row) if row else None
        if snapshot is None:
            continue
        snapshots[key] = snapshot
        direct_matches += 1
        del remaining[key]

    current_rows = fetch_population(args.start_date, args.end_date)
    current_scored = score_population(current_rows)
    current_matches = 0
    methods = {"hltv-id": 0, "exact-alias": 0, "normalized-alias": 0}

    for key, alias in list(remaining.items()):
        row, method = match_row(alias, known_ids.get(key), current_scored)
        if row is None or method is None:
            continue
        snapshots[key] = snapshot_from_row(alias, row, method, args.start_date, args.end_date, "last12m")
        methods[method] += 1
        current_matches += 1
        del remaining[key]

    historical_matches = 0
    years_scanned: list[int] = []
    current_year = dt.date.fromisoformat(args.end_date).year

    for year in range(current_year - 1, args.oldest_year - 1, -1):
        if not remaining:
            break
        start = f"{year}-01-01"
        end = f"{year}-12-31"
        rows = fetch_population(start, end)
        years_scanned.append(year)
        if not rows:
            continue
        scored = score_population(rows)
        for key, alias in list(remaining.items()):
            row, method = match_row(alias, known_ids.get(key), scored)
            if row is None or method is None:
                continue
            snapshots[key] = snapshot_from_row(alias, row, method, start, end, "calendar-year")
            methods[method] += 1
            historical_matches += 1
            del remaining[key]

    direct_recognized = 0
    for key, alias in remaining.items():
        direct_row = direct.get(key)
        player_id = known_ids.get(key)
        recognized = player_id is not None or (direct_row is not None and direct_row.get("status") != "unmatched")
        if recognized:
            direct_recognized += 1
        snapshots[key] = empty_snapshot(
            alias,
            player_id,
            args.start_date,
            args.end_date,
            "no-data" if recognized else "unmatched",
        )

    with_stats = sum(1 for s in snapshots.values() if s["status"] == "ok")
    no_data = sum(1 for s in snapshots.values() if s["status"] == "no-data")
    unmatched = sum(1 for s in snapshots.values() if s["status"] == "unmatched")

    meta = {
        "source": "HLTV statistics",
        "providers": ["HLTV mobile PlayerScreen", "api.csapi.de HLTV-derived aggregates"],
        "window": "current+last12m+latest-year-fallback",
        "windowLabel": "Current HLTV form, then last 12 months, then latest available calendar year",
        "startDate": args.start_date,
        "endDate": args.end_date,
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "requestedPlayers": len(aliases),
        "knownProfileIds": len(known_ids),
        "directPlayerScreenStats": direct_matches,
        "providerCurrentPlayers": len(current_rows),
        "currentWindowFallbackStats": current_matches,
        "historicalFallbackStats": historical_matches,
        "withStats": with_stats,
        "recognizedNoStats": no_data,
        "unmatched": unmatched,
        "errors": 0,
        "matchMethods": methods,
        "yearsScanned": years_scanned,
    }
    if with_stats < 1000:
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
