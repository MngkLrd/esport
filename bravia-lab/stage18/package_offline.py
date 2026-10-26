#!/usr/bin/env python3
"""Build a NON-INSTALLABLE source/preview archive from an explicit safe allowlist.

No Sony OTA, proprietary ELF, device dumps, DRM or secrets are included.
This tool never contacts or modifies a TV.
"""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
REPO = LAB.parent
SAFE_EXT = frozenset((
    ".py", ".md", ".c", ".h", ".js", ".html", ".css", ".json",
    ".cjs", ".yml", ".svg", ".sh", ".txt",
))
OMIT_NAMES = frozenset(("__pycache__", ".git", "node_modules", ".venv"))
# New source added after the original 99 paths: these are narrowly scoped.
ADDITIONS = (
    "package.json",
    "STAGE15_REAL_ELF_AND_MIGRATION.md",
    "STAGE16_HOST_SIMULATOR.md",
    "STAGE17_LOGO_BLUR_PRODUCT.md",
    "native_core/directfb_logos.c",
    "native_core/directfb_logos.h",
    "tests/test_directfb_logo_loader.c",
)
STAGE_SUBDIRS = ("stage15", "stage16", "stage17", "stage18")
MAX_FILE = 8 * 1024 * 1024
MAX_TOTAL = 32 * 1024 * 1024


def approved_paths(include_generated=True):
    inventory = json.loads((LAB / "stage18/source_inventory.json").read_text(encoding="utf-8"))
    if inventory.get("origin_bravialab_file_count") != 99:
        raise ValueError("Incomplete original source inventory")
    names = set(inventory["source_files"])
    if len(names) != 99:
        raise ValueError("Duplicate baseline paths")
    names.update("bravia-lab/" + p for p in ADDITIONS)
    names.add(".github/workflows/bravia-home-ci.yml")
    for dirname in STAGE_SUBDIRS:
        directory = LAB / dirname
        for file in directory.rglob("*"):
            if not file.is_file() or any(part in OMIT_NAMES for part in file.parts):
                continue
            relative = file.relative_to(REPO).as_posix()
            if file.suffix.lower() in SAFE_EXT:
                names.add(relative)
            if (include_generated and dirname == "stage17" and
                    file.suffix.lower() == ".png" and
                    file.relative_to(LAB).parts[:2] in
                    (("stage17", "assets"), ("stage17", "previews"))):
                names.add(relative)
    return sorted(names)


def safe_manifest(include_generated=True):
    approved = approved_paths(include_generated)
    items = []
    total = 0
    for name in approved:
        file = REPO / name
        if not file.is_file():
            raise FileNotFoundError(name)
        if file.is_symlink():
            raise ValueError("Symlinks prohibited: " + name)
        if name.startswith("/") or ".." in Path(name).parts:
            raise ValueError("Unsafe archive path: " + name)
        if (Path(name).suffix.lower() not in SAFE_EXT and
                Path(name).name != "Makefile" and
                not (include_generated and name.startswith("bravia-lab/stage17/") and
                     Path(name).suffix.lower() == ".png")):
            raise ValueError("Not an approved source/preview type: " + name)
        size = file.stat().st_size
        total += size
        if size > MAX_FILE or total > MAX_TOTAL:
            raise ValueError("Source or preview exceeds safe archive size bound")
        data = file.read_bytes()
        items.append({"path": name, "bytes": size,
                      "sha256": hashlib.sha256(data).hexdigest()})
    return items


def bundle(output, include_generated=True):
    output = Path(output)
    items = safe_manifest(include_generated)
    meta = {
        "type": "NON_INSTALLABLE_OFFLINE_RESEARCH_SOURCES",
        "device": "Sony BRAVIA KD-55XG7096",
        "contains_sony_firmware": False,
        "contains_oem_binary_or_drm": False,
        "safe_to_flash": False,
        "origin_migration_files": 99,
        "file_count": len(items),
        "files": items,
    }
    text = json.dumps(meta, ensure_ascii=False, indent=2) + "\n"
    content = (
        "BRAVIA HOME OFFLINE RESEARCH BUNDLE — NOT INSTALLABLE\n"
        "Contains original authored research/source, tests and permitted previews.\n"
        "Contains no Sony firmware, app-manager binary, DRM material, OEM libraries\n"
        "or signed USB update. Do not flash this ZIP to the television.\n"
        "Reproduce: see bravia-lab/stage18/PRIVACY_PRODUCT_POLICY.md and\n"
        "bravia-lab/stage18/FEASIBILITY_AUDIT.md.\n"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in (
                ("README_OFFLINE.txt", content.encode("utf-8")),
                ("SHA256_MANIFEST.json", text.encode("utf-8"))):
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)
        for item in items:
            info = zipfile.ZipInfo(item["path"], (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, (REPO / item["path"]).read_bytes())
    with zipfile.ZipFile(output) as z:
        if z.testzip():
            raise ValueError("ZIP CRC verification failed")
    return meta


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--without-generated", action="store_true")
    args = parser.parse_args(argv)
    summary = bundle(args.output, include_generated=not args.without_generated)
    print("NON-INSTALLABLE offline bundle:", args.output)
    print("authored files:", summary["file_count"], "original path count:", 99)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
