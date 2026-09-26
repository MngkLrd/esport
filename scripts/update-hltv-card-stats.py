#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import random
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
HLTV = "https://www.hltv.org"
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152.0 Safari/537.36",
]
SKILLS = ("Firepower", "Entrying", "Trading", "Opening", "Clutching", "Sniping", "Utility")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--start-date", required=True)
    p.add_argument("--end-date", required=True)
    p.add_argument("--output", default="src/hltvCardStats.generated.ts")
    p.add_argument("--report", default="hltv-card-report.json")
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--limit", type=int, default=0)
    return p.parse_args()


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


def metadata_profile_urls() -> dict[str, str]:
    text = (ROOT / "src/playerMetadata.ts").read_text(encoding="utf-8")
    out: dict[str, str] = {}
    for match in re.finditer(r'^\s*"([^"]+)":\s*\{([^\n]+)\}', text, re.M):
        alias, body = match.groups()
        url_match = re.search(r'profileUrl:"([^"]+)"', body)
        if url_match:
            out[alias.casefold()] = url_match.group(1)
    return out


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": "https://www.hltv.org/stats",
    })
    return s


def get_html(url: str, tries: int = 4) -> str:
    last: Exception | None = None
    for attempt in range(tries):
        try:
            s = session()
            r = s.get(url, timeout=30)
            if r.status_code == 200 and len(r.text) > 1000:
                return r.text
            if r.status_code in (403, 429):
                time.sleep(3 + attempt * 4)
                continue
            raise RuntimeError(f"HTTP {r.status_code} for {url}")
        except Exception as exc:
            last = exc
            time.sleep(1.5 + attempt * 2)
    raise RuntimeError(str(last) if last else f"Unable to fetch {url}")


def discover_profiles(start_date: str, end_date: str) -> dict[str, str]:
    params = urlencode({
        "startDate": start_date,
        "endDate": end_date,
        "gameVersion": "CS2",
        "minMapCount": 1,
    })
    html = get_html(f"{HLTV}/stats/players?{params}")
    soup = BeautifulSoup(html, "html.parser")
    result: dict[str, str] = {}
    for link in soup.find_all("a", href=re.compile(r"^/stats/players/\d+/")):
        alias = link.get_text(" ", strip=True)
        if not alias:
            continue
        path = link.get("href")
        if path:
            result.setdefault(alias.casefold(), urljoin(HLTV, path.split("?", 1)[0]))
    return result


def number_before_label(text: str, label: str, percent: bool = False) -> float | None:
    pct = "%" if percent else ""
    m = re.search(rf"(\d+(?:\.\d+)?)\s*{re.escape(pct)}\s*{re.escape(label)}\b", text, re.I)
    return float(m.group(1)) if m else None


def parse_player(alias: str, profile_url: str, start_date: str, end_date: str) -> dict[str, Any]:
    params = urlencode({
        "startDate": start_date,
        "endDate": end_date,
        "gameVersion": "CS2",
    })
    url = profile_url.split("?", 1)[0] + "?" + params
    try:
        html = get_html(url)
        soup = BeautifulSoup(html, "html.parser")
        text = " ".join(soup.stripped_strings)

        maps_match = re.search(r"([\d,]+)\s+maps\b", text, re.I)
        maps = int(maps_match.group(1).replace(",", "")) if maps_match else None

        skills: dict[str, int | None] = {}
        for name in SKILLS:
            m = re.search(rf"\b{re.escape(name)}\b.*?(\d{{1,3}})\s*/\s*100", text, re.I)
            skills[name.casefold()] = int(m.group(1)) if m else None

        rating = number_before_label(text, "Rating 2.0")
        kpr = number_before_label(text, "KPR")
        dpr = number_before_label(text, "DPR")
        adr = number_before_label(text, "ADR")
        kast = number_before_label(text, "KAST", percent=True)

        has_skill = any(v is not None for v in skills.values())
        has_core = any(v is not None for v in (rating, kpr, dpr, adr, kast))
        status = "ok" if has_skill or has_core else "no-data"

        return {
            "alias": alias,
            "profileUrl": profile_url,
            "status": status,
            "periodStart": start_date,
            "periodEnd": end_date,
            "maps": maps,
            "rating20": rating,
            "kpr": kpr,
            "dpr": dpr,
            "adr": adr,
            "kast": kast,
            "skills": {
                "firepower": skills["firepower"],
                "entrying": skills["entrying"],
                "trading": skills["trading"],
                "opening": skills["opening"],
                "clutching": skills["clutching"],
                "sniping": skills["sniping"],
                "utility": skills["utility"],
            },
        }
    except Exception as exc:
        return {
            "alias": alias,
            "profileUrl": profile_url,
            "status": "error",
            "periodStart": start_date,
            "periodEnd": end_date,
            "maps": None,
            "rating20": None,
            "kpr": None,
            "dpr": None,
            "adr": None,
            "kast": None,
            "skills": {key.casefold(): None for key in SKILLS},
            "error": str(exc)[:240],
        }


def ts_value(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def render_ts(snapshots: dict[str, dict[str, Any]], meta: dict[str, Any]) -> str:
    rows = []
    for key in sorted(snapshots):
        rows.append(f"  {json.dumps(key)}: {ts_value(snapshots[key])},")
    return (
        "// AUTO-GENERATED by scripts/update-hltv-card-stats.py. DO NOT EDIT.\n"
        "import type { HltvPlayerSnapshot } from './cardStats'\n\n"
        f"export const HLTV_CARD_SNAPSHOT_META = {ts_value(meta)} as const\n\n"
        "export const HLTV_CARD_SNAPSHOTS: Readonly<Record<string, HltvPlayerSnapshot>> = {\n"
        + "\n".join(rows)
        + "\n}\n"
    )


def main() -> None:
    args = parse_args()
    aliases = repo_aliases()
    if args.limit > 0:
        aliases = aliases[: args.limit]

    known = metadata_profile_urls()
    discovered = discover_profiles(args.start_date, args.end_date)
    profile_urls = {**discovered, **known}

    snapshots: dict[str, dict[str, Any]] = {}
    tasks: list[tuple[str, str]] = []
    for alias in aliases:
        key = alias.casefold()
        url = profile_urls.get(key)
        if url:
            tasks.append((alias, url))
        else:
            snapshots[key] = {
                "alias": alias,
                "profileUrl": None,
                "status": "unmatched",
                "periodStart": args.start_date,
                "periodEnd": args.end_date,
                "maps": None,
                "rating20": None,
                "kpr": None,
                "dpr": None,
                "adr": None,
                "kast": None,
                "skills": {
                    "firepower": None,
                    "entrying": None,
                    "trading": None,
                    "opening": None,
                    "clutching": None,
                    "sniping": None,
                    "utility": None,
                },
            }

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        future_map = {
            pool.submit(parse_player, alias, url, args.start_date, args.end_date): alias
            for alias, url in tasks
        }
        done = 0
        for future in concurrent.futures.as_completed(future_map):
            alias = future_map[future]
            snapshots[alias.casefold()] = future.result()
            done += 1
            if done % 50 == 0 or done == len(tasks):
                print(f"Fetched {done}/{len(tasks)} matched HLTV profiles", flush=True)
            time.sleep(0.04)

    with_stats = sum(1 for s in snapshots.values() if s["status"] == "ok")
    errors = sum(1 for s in snapshots.values() if s["status"] == "error")
    unmatched = sum(1 for s in snapshots.values() if s["status"] == "unmatched")
    no_data = sum(1 for s in snapshots.values() if s["status"] == "no-data")

    meta = {
        "source": "HLTV",
        "startDate": args.start_date,
        "endDate": args.end_date,
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "requestedPlayers": len(aliases),
        "matchedProfiles": len(tasks),
        "withStats": with_stats,
        "noData": no_data,
        "unmatched": unmatched,
        "errors": errors,
    }

    output = ROOT / args.output
    output.write_text(render_ts(snapshots, meta), encoding="utf-8")
    (ROOT / args.report).write_text(json.dumps({"meta": meta}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
