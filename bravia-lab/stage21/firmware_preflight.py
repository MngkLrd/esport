#!/usr/bin/env python3
"""Read-only Sony v8.931-1000 preflight: owner-TV version + optional OEM hashes.

No Sony native calls, USB updater operations, firmware writes or signatures.
A matching displayed version NEVER proves a live byte-for-byte firmware match.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

MODEL = "KD-55XG7096"
RESEARCH_VERSION = "8.931-1000"
REPORTED_TV_VERSION = "8.931-1000-4.000-0000"
PINS = {
    "ota_zip": ("9fedce4521bb3b9d2fc0d8e8a19d31a795752026d1a17249b1ccf712c25b606c", 350_000_000),
    "app_man": ("29fca75522ccd66abba528b8622ccda944e6b15455dd812c1f2036d710c14702", 40_000_000),
    "libapp_client.so": ("bbe9eb3d74c8e793b5d93e0a96edbb4d1e89fe8b3e259791c95b5836c3eb8636", 40_000_000),
    "launcher.bin": ("1c29e9f4175e825500b57874b37c5257fd8ce162b53ca061cc43a47e8c579480", 40_000_000),
}
# Report labels; do not disclose filesystem locations or raw binary strings.
SYMBOL_MARKERS = {
    "dockui_xml_name": b"DockUI.xml",
    "dynamic_service_list_name": b"service_list",
    "sony_app_client_name": b"libapp_client.so",
    "directfb_name": b"libdirectfb.so",
    "netflix_name": b"Netflix",
    "youtube_name": b"YouTube",
    "amazon_name": b"Amazon",
    "opera_name": b"Opera",
}


def classify_version(displayed):
    """Only 8.931-1000 matched; trailing fields require OEM confirmation."""
    valid = re.fullmatch(r"(\d+\.\d+)-(\d+)-(\d+\.\d+)-(\d+)", displayed or "")
    if not valid:
        return "INVALID_FORMAT"
    primary = valid.group(1) + "-" + valid.group(2)
    return "RESEARCH_VERSION_FAMILY_MATCH_ONLY" if primary == RESEARCH_VERSION else "DIFFERENT_FIRMWARE"


def sha256_bounded(path, limit):
    path = Path(path)
    if not path.is_file() or path.is_symlink():
        raise ValueError("Expected a regular non-symlink OEM file")
    if path.stat().st_size > limit:
        raise ValueError("OEM file size exceeds bounded audit limit")
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while True:
            data = stream.read(1_048_576)
            if not data:
                break
            digest.update(data)
    return digest.hexdigest()


def probe(displayed, *, ota_zip=None, app_man=None, libapp_client=None,
          launcher=None):
    version_verdict = classify_version(displayed)
    data = {
        "mode": "READ_ONLY_LOCAL_FILE_PREFLIGHT",
        "model": MODEL,
        "tv_reported_version": displayed,
        "research_primary_version": RESEARCH_VERSION,
        "version_verdict": version_verdict,
        "tv_live_files_examined": False,
        "tv_suffix_byte_match_verified": False,
        "sony_loader_verified": False,
        "firmware_write_permitted": False,
        "files": {},
        "menu_notes": [
            "String markers in a launcher do not prove XML-driven menu configuration.",
            "File hashes verify only privately supplied offline artifacts, not live TV flash contents.",
            "Sony DockUI is a native ARM DirectFB app located in a protected partition.",
        ],
    }
    sources = {
        "ota_zip": ota_zip, "app_man": app_man,
        "libapp_client.so": libapp_client, "launcher.bin": launcher,
    }
    all_present = all(path is not None for path in sources.values())
    all_match = all_present
    for label, source in sources.items():
        if source is None:
            data["files"][label] = {"provided": False, "pin_match": None}
            continue
        expected, limit = PINS[label]
        path = Path(source)
        hashed = sha256_bounded(path, limit)
        matched = hashed == expected
        data["files"][label] = {"provided": True, "pin_match": matched}
        if label == "launcher.bin":
            # Only static, bounded marker search on a pinned OEM executable.
            # No commands are executed; no byte or URL is exported.
            if matched:
                binary = path.read_bytes()
                data["files"][label]["indicators"] = {
                    key: marker in binary for key, marker in SYMBOL_MARKERS.items()
                }
            else:
                data["files"][label]["indicators"] = None
        all_match = all_match and matched
    if version_verdict != "RESEARCH_VERSION_FAMILY_MATCH_ONLY":
        data["next_step"] = "STOP_WRONG_FIRMWARE"
    elif all_match:
        data["next_step"] = "OFFLINE_OEM_REFERENCE_MATCH_ONLY"
    else:
        data["next_step"] = "NEED_PRIVATE_OEM_HASHES_FOR_BUILD_ID_CONFIRMATION"
    return data


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tv-version", required=True)
    parser.add_argument("--ota-zip", type=Path)
    parser.add_argument("--app-man", type=Path)
    parser.add_argument("--libapp-client", type=Path)
    parser.add_argument("--launcher", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    report = probe(args.tv_version, ota_zip=args.ota_zip, app_man=args.app_man,
                   libapp_client=args.libapp_client, launcher=args.launcher)
    out = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(out, encoding="utf-8")
    print(out, end="")
    return 0 if report["version_verdict"] == "RESEARCH_VERSION_FAMILY_MATCH_ONLY" and (
        all(not x["provided"] or x["pin_match"] for x in report["files"].values())) else 2


if __name__ == "__main__":
    raise SystemExit(main())
