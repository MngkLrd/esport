#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import random
import re
import threading
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

from curl_cffi import requests

ROOT = Path(__file__).resolve().parents[1]
MOBILE_BASE = "https://www.hltv.org/mobile"
APP_VERSION = "3.0.34"
PACKAGE = "org.hltv.android"

_thread_local = threading.local()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build current HLTV player-card snapshots for every player in the repo pool.")
    p.add_argument("--end-date", required=True, help="Snapshot date (YYYY-MM-DD).")
    p.add_argument("--output", default="src/hltvCardStats.generated.ts")
    p.add_argument("--report", default="data/hltv-card-report.json")
    p.add_argument("--workers", type=int, default=6)
    p.add_argument("--limit", type=int, default=0)
    return p.parse_args()


def three_months_before(value: str) -> str:
    date = dt.date.fromisoformat(value)
    month = date.month - 3
    year = date.year
    while month <= 0:
        month += 12
        year -= 1
    month_lengths = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(date.day, month_lengths[month - 1])
    return dt.date(year, month, day).isoformat()


def repo_aliases() -> list[str]:
    players = (ROOT / "src/players.ts").read_text(encoding="utf-8")
    vrs = (ROOT / "src/vrs.ts").read_text(encoding="utf-8")

    curated = players.split("const CURATED_REAL_PLAYERS", 1)[1].split("] as const", 1)[0]
    curated_aliases = re.findall(r"alias:\s*'([^']+)'", curated)

    vrs_block = vrs.split("export const VRS_PLAYERS", 1)[1].split("export const VRS_STATS", 1)[0]
    vrs_aliases = re.findall(r'alias:\s*"([^"]+)"', vrs_block)

    result: list[str] = []
    seen: set[str] = set()
    for alias in [*curated_aliases, *vrs_aliases]:
        key = alias.casefold()
        if key not in seen:
            seen.add(key)
            result.append(alias)
    return result


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


def _session():
    current = getattr(_thread_local, "session", None)
    if current is not None:
        return current
    current = requests.Session(impersonate="chrome120")
    current.headers.update({
        "User-Agent": f"{PACKAGE}/{APP_VERSION};release(Android; Pixel 8; Android 14)",
        "Referer": "https://www.hltv.org/",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
    })
    _thread_local.session = current
    return current


def mobile_get(path: str, params: dict[str, Any]) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(7):
        try:
            response = _session().get(
                f"{MOBILE_BASE}/{path.lstrip('/')}",
                params=params,
                timeout=25,
            )
            if response.status_code < 400:
                value = response.json()
                if isinstance(value, dict):
                    return value
                raise RuntimeError(f"Unexpected JSON payload for {path}")
            if response.status_code not in (403, 429, 500, 502, 503, 504):
                raise RuntimeError(f"HTTP {response.status_code} for {path}: {response.text[:160]}")
            retry_after = response.headers.get("Retry-After")
            delay = float(retry_after) if retry_after and retry_after.replace(".", "", 1).isdigit() else 0.0
            if delay <= 0:
                delay = min(20.0, 1.2 * (2 ** attempt) + random.uniform(0.1, 0.8))
            time.sleep(delay)
        except Exception as exc:
            last_error = exc
            time.sleep(min(20.0, 1.2 * (2 ** attempt) + random.uniform(0.1, 0.8)))
    raise RuntimeError(str(last_error) if last_error else f"Unable to fetch {path}")


def normalize_alias(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def search_player_id(alias: str) -> int | None:
    payload = mobile_get("v2/search", {"term": alias})
    players = payload.get("players") or []
    exact: list[int] = []
    normalized: list[int] = []

    for item in players:
        if not isinstance(item, dict):
            continue
        data = item.get("playerData") if isinstance(item.get("playerData"), dict) else item
        nick = data.get("nick") or item.get("nick")
        raw_id = data.get("playerId") or data.get("id") or item.get("playerId") or item.get("id")
        if not nick or raw_id is None:
            continue
        try:
            player_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if str(nick).casefold() == alias.casefold():
            exact.append(player_id)
        elif normalize_alias(str(nick)) == normalize_alias(alias):
            normalized.append(player_id)

    if len(set(exact)) == 1:
        return exact[0]
    if not exact and len(set(normalized)) == 1:
        return normalized[0]
    return None


def as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        value = value.strip().rstrip("%").lstrip("+")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> int | None:
    parsed = as_float(value)
    return int(round(parsed)) if parsed is not None else None


def empty_skills() -> dict[str, None]:
    return {
        "firepower": None,
        "entrying": None,
        "trading": None,
        "opening": None,
        "clutching": None,
        "sniping": None,
        "utility": None,
    }


def snapshot_base(alias: str, player_id: int | None, start_date: str, end_date: str) -> dict[str, Any]:
    return {
        "alias": alias,
        "playerId": player_id,
        "profileUrl": f"https://www.hltv.org/player/{player_id}/{quote(alias)}" if player_id else None,
        "status": "unmatched" if player_id is None else "no-data",
        "window": "past3m",
        "periodStart": start_date,
        "periodEnd": end_date,
        "maps": None,
        "rating": None,
        "ratingVersion": None,
        "kpr": None,
        "dpr": None,
        "adr": None,
        "kast": None,
        "multiKillPct": None,
        "skills": empty_skills(),
    }


def fetch_player(alias: str, known_id: int | None, start_date: str, end_date: str) -> dict[str, Any]:
    player_id = known_id
    try:
        if player_id is None:
            player_id = search_player_id(alias)
        result = snapshot_base(alias, player_id, start_date, end_date)
        if player_id is None:
            return result

        payload = mobile_get("PlayerScreen", {"playerId": player_id})
        stats = payload.get("stats") if isinstance(payload.get("stats"), dict) else {}
        versioned = stats.get("versionedRating") if isinstance(stats.get("versionedRating"), dict) else {}

        skills = {
            "firepower": as_int(stats.get("firepower")),
            "entrying": as_int(stats.get("entrying")),
            "trading": as_int(stats.get("trading")),
            "opening": as_int(stats.get("opening")),
            "clutching": as_int(stats.get("clutching")),
            "sniping": as_int(stats.get("sniping")),
            "utility": as_int(stats.get("utility")),
        }

        required = [
            skills["firepower"],
            skills["utility"],
            skills["clutching"],
            skills["trading"],
            skills["opening"],
            skills["entrying"],
        ]
        result.update({
            "profileUrl": f"https://www.hltv.org/player/{player_id}/{quote(str(payload.get('nick') or alias))}",
            "status": "ok" if sum(value is not None for value in required) >= 5 else "no-data",
            "rating": as_float(versioned.get("value") or stats.get("rating")),
            "ratingVersion": versioned.get("version"),
            "kpr": as_float(stats.get("killsPrRound")),
            "dpr": as_float(stats.get("dpr")),
            "adr": as_float(stats.get("adr")),
            "kast": as_float(stats.get("kast")),
            "multiKillPct": as_float(stats.get("multiKills")),
            "skills": skills,
        })
        return result
    except Exception as exc:
        result = snapshot_base(alias, player_id, start_date, end_date)
        result["status"] = "error"
        result["error"] = str(exc)[:260]
        return result


def render_ts(snapshots: dict[str, dict[str, Any]], meta: dict[str, Any]) -> str:
    rows = [
        f"  {json.dumps(key)}: {json.dumps(snapshots[key], ensure_ascii=False, separators=(',', ':'))},"
        for key in sorted(snapshots)
    ]
    return (
        "// AUTO-GENERATED by scripts/update-hltv-card-stats.py. DO NOT EDIT.\n"
        "import type { HltvPlayerSnapshot } from './cardStats'\n\n"
        f"export const HLTV_CARD_SNAPSHOT_META = {json.dumps(meta, ensure_ascii=False, separators=(',', ':'))} as const\n\n"
        "export const HLTV_CARD_SNAPSHOTS: Readonly<Record<string, HltvPlayerSnapshot>> = {\n"
        + "\n".join(rows)
        + "\n}\n"
    )


def main() -> None:
    args = parse_args()
    end_date = args.end_date
    start_date = three_months_before(end_date)

    aliases = repo_aliases()
    if args.limit > 0:
        aliases = aliases[: args.limit]

    known_ids = metadata_profile_ids()
    snapshots: dict[str, dict[str, Any]] = {}
    completed = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {
            pool.submit(fetch_player, alias, known_ids.get(alias.casefold()), start_date, end_date): alias
            for alias in aliases
        }
        for future in concurrent.futures.as_completed(futures):
            alias = futures[future]
            snapshots[alias.casefold()] = future.result()
            completed += 1
            if completed % 50 == 0 or completed == len(aliases):
                ok = sum(1 for s in snapshots.values() if s["status"] == "ok")
                print(f"Processed {completed}/{len(aliases)} · HLTV stats {ok}", flush=True)

    with_stats = sum(1 for s in snapshots.values() if s["status"] == "ok")
    no_data = sum(1 for s in snapshots.values() if s["status"] == "no-data")
    unmatched = sum(1 for s in snapshots.values() if s["status"] == "unmatched")
    errors = sum(1 for s in snapshots.values() if s["status"] == "error")
    matched = len(aliases) - unmatched - errors

    meta = {
        "source": "HLTV mobile PlayerScreen",
        "window": "past3m",
        "windowLabel": "Past 3 months",
        "startDate": start_date,
        "endDate": end_date,
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "requestedPlayers": len(aliases),
        "knownProfileIds": sum(1 for alias in aliases if alias.casefold() in known_ids),
        "matchedProfiles": matched,
        "withStats": with_stats,
        "noData": no_data,
        "unmatched": unmatched,
        "errors": errors,
    }

    # Do not replace a good dataset with a globally-blocked/broken scrape.
    if args.limit == 0 and with_stats < 100:
        raise RuntimeError(f"HLTV coverage gate failed: only {with_stats}/{len(aliases)} players returned usable stats")

    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render_ts(snapshots, meta), encoding="utf-8")

    report = ROOT / args.report
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        "meta": meta,
        "unmatchedAliases": sorted(s["alias"] for s in snapshots.values() if s["status"] == "unmatched"),
        "noDataAliases": sorted(s["alias"] for s in snapshots.values() if s["status"] == "no-data"),
        "errorAliases": sorted(s["alias"] for s in snapshots.values() if s["status"] == "error"),
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(meta, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
