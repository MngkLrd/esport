#!/usr/bin/env python3
"""Bounded, read-only tracker *indicator* scan on user-extracted Sony file trees.

This never parses an OTA image, accesses the TV, alters firmware, or claims
runtime network transmission. It deliberately emits no raw strings/URLs/IDs.
"""
import argparse
import json
import os
import re
from pathlib import Path

MAX_ENTRIES = 30000
MAX_CANDIDATES = 700
MAX_TEXT_BYTES = 262144
TEXT_SUFFIX = frozenset((".xml", ".ini", ".json", ".html", ".js", ".txt", ".cfg", ".sh"))
NAMES = frozenset(("am_start.ini", "am_config", "acrsetting.xml",
                   "default_setting.xml", "cidclient", "start_samba"))
TOKENS = ("samba", "mixpanel", "telemetry", "analytics", "tracking",
          "globoplay", "diagnostic", "crashreport")

def candidate(rel):
    name = rel.name.lower()
    return name in NAMES or any(token in str(rel).lower() for token in TOKENS)

def observe(roots):
    if not isinstance(roots, dict) or not roots:
        raise ValueError("At least one extracted root must be provided")
    records = []
    findings = {
        "samba_component_present": False,
        "samba_factory_default_disabled": False,
        "mixpanel_reference_present": False,
        "globoplay_autostart_reference": False,
    }
    total_scanned = 0
    skipped_links = 0
    truncated = False
    for label, root in sorted(roots.items()):
        root = Path(root)
        if not root.is_dir() or root.is_symlink():
            raise ValueError("Missing or invalid extracted root: " + str(label))
        for base, dirs, filenames in os.walk(root, followlinks=False):
            dirs[:] = sorted(d for d in dirs if not (Path(base)/d).is_symlink())
            for name in sorted(filenames):
                path = Path(base) / name
                total_scanned += 1
                if total_scanned > MAX_ENTRIES or len(records) >= MAX_CANDIDATES:
                    truncated = True
                    break
                if path.is_symlink():
                    skipped_links += 1
                    continue
                rel = path.relative_to(root)
                if not candidate(rel) or not path.is_file():
                    continue
                relstr = rel.as_posix()
                # Metadata only: never publish potentially personal content.
                entry = {"tree": str(label), "relative_path": relstr,
                         "kind": "candidate_name_only", "runtime_active": "UNKNOWN"}
                low = relstr.lower()
                if "samba" in low:
                    findings["samba_component_present"] = True
                if path.suffix.lower() in TEXT_SUFFIX and path.stat().st_size <= MAX_TEXT_BYTES:
                    content = path.read_bytes().decode("utf-8", errors="replace").lower()
                    if "mixpanel.init" in content:
                        findings["mixpanel_reference_present"] = True
                        entry["contains_mixpanel_symbol"] = True
                    if name.lower() == "default_setting.xml":
                        disabled = any(re.search(p, content, re.I) for p in (
                            r"enabled\s*=\s*['\"]?false\b",
                            r"<enabled>\s*false\s*</enabled>",
                        ))
                        if disabled:
                            findings["samba_factory_default_disabled"] = True
                            entry["factory_opt_in_default_disabled"] = True
                    if name.lower() == "am_start.ini":
                        if (re.search(r"globoplay.{0,400}start_self\s*=\s*true",content,re.S)
                            or re.search(r"start_self\s*=\s*true.{0,400}globoplay",content,re.S)):
                            findings["globoplay_autostart_reference"] = True
                            entry["globoplay_autostart_reference"] = True
                records.append(entry)
            if truncated:
                break
        if truncated:
            break
    return {
        "mode": "READ_ONLY_EXTRACTED_FILES",
        "runtime_tv_state": "UNKNOWN",
        "network_traffic_confirmed": False,
        "telemetry_disabled_on_tv": False,
        "scanned_directory_entries": total_scanned,
        "skipped_symlink_files": skipped_links,
        "truncated": truncated,
        "candidate_count": len(records),
        "indicators": findings,
        "candidates": records,
        "interpretation": "Presence of files, strings or factory defaults does not prove runtime tracking or device consent.",
    }

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rootfs", type=Path, required=True)
    parser.add_argument("--thirdparty", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    roots = {"root": args.rootfs}
    if args.thirdparty:
        roots["3rdp"] = args.thirdparty
    result = observe(roots)
    output = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    print(output, end="")
    return 2 if result["truncated"] else 0

if __name__ == "__main__":
    raise SystemExit(main())
