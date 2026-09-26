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


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build collectible card snapshots from HLTV-derived match stats.")
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
        url_match = re.search(r'profileUrl:"([^"]+)"', body)
        if not url_match:
            continue
        id_match = re.search(r'/(?:player|stats/players)/(\d+)(?:/|$)', url_match.group(1))
        if id_match:
            out[alias.casefold()] = int(id_match.group(1))
    return out


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
    # Shrink tiny samples toward 50. At 50 maps the percentile score is fully trusted.
    confidence = min(1.0, math.sqrt(max(0, maps) / 50.0))
    return int(round(max(1.0, min(99.0, 50.0 + (score - 50.0) * confidence))))


def weighted(parts: list[tuple[float, float]]) -> float:
    total = sum(weight for _, weight in parts)
    return sum(value * weight for value, weight in parts) / total if total else 50.0


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

        # These are our card categories, derived only from factual HLTV match metrics.
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
        "window": window,
        "periodStart": start_date,
        "periodEnd": end_date,
        "raw": row["_raw"],
        "cardScores": row["_cardScores"],
    }


def empty_snapshot(alias: str, player_id: int | None, start_date: str, end_date: str, status: str) -> dict[str, Any]:
    return {
        "alias": alias,
        "playerId": player_id,
        "profileUrl": f"https://www.hltv.org/player/{player_id}/{quote(alias)}" if player_id else None,
        "status": status,
        "matchMethod": "hltv-id" if player_id else None,
        "window": "last12m",
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
    snapshots: dict[str, dict[str, Any]] = {}
    remaining = {alias.casefold(): alias for alias in aliases}

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

    for key, alias in remaining.items():
        player_id = known_ids.get(key)
        snapshots[key] = empty_snapshot(
            alias,
            player_id,
            args.start_date,
            args.end_date,
            "no-data" if player_id is not None else "unmatched",
        )

    with_stats = sum(1 for s in snapshots.values() if s["status"] == "ok")
    no_data = sum(1 for s in snapshots.values() if s["status"] == "no-data")
    unmatched = sum(1 for s in snapshots.values() if s["status"] == "unmatched")

    meta = {
        "source": "HLTV-derived match statistics",
        "provider": "api.csapi.de",
        "window": "last12m+latest-year-fallback",
        "windowLabel": "Last 12 months, then latest available calendar year",
        "startDate": args.start_date,
        "endDate": args.end_date,
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "requestedPlayers": len(aliases),
        "providerCurrentPlayers": len(current_rows),
        "currentWindowStats": current_matches,
        "historicalFallbackStats": historical_matches,
        "withStats": with_stats,
        "noData": no_data,
        "unmatched": unmatched,
        "errors": 0,
        "matchMethods": methods,
        "yearsScanned": years_scanned,
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
