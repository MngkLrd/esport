#!/usr/bin/env python3
"""BENCH-ONLY path edit on an exact original Sony v8.931 DockUI binary.
Not a signing, app-install, bootloader or firmware update tool.
"""
import argparse, hashlib, json
from pathlib import Path
OEM_SHA = "1c29e9f4175e825500b57874b37c5257fd8ce162b53ca061cc43a47e8c579480"
OLD = b"/basic/DockUI.xml\0"
NEW = b"/3rd_rw/home.xml\0\0"
assert len(OLD) == len(NEW)

def patch(original, output):
    src, dst = Path(original), Path(output)
    if src.is_symlink() or not src.is_file():
        raise ValueError("Owner-extracted original launcher.bin required")
    orig = src.read_bytes()
    if len(orig) != 125080 or hashlib.sha256(orig).hexdigest() != OEM_SHA:
        raise ValueError("Different Sony executable; refusing to patch")
    if orig.count(OLD) != 1:
        raise ValueError("Expected unique original path was not found")
    if src.resolve() == dst.resolve() or dst.exists():
        raise ValueError("Never overwrite the original or an existing output")
    location = orig.index(OLD)
    mutated = orig[:location] + NEW + orig[location + len(OLD):]
    assert len(mutated) == len(orig)
    assert orig[:location] == mutated[:location]
    assert orig[location + len(OLD):] == mutated[location + len(OLD):]
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(mutated)
    return {
        "status": "UNFLASHABLE_OFFLINE_EXPERIMENT",
        "patched_sha256": hashlib.sha256(mutated).hexdigest(),
        "size_unchanged": len(orig) == len(mutated),
        "changed_bytes": sum(a != b for a, b in zip(orig,mutated)),
        "string_file_offset": location,
        "sony_signature_verified": False,
        "dm_verity_still_valid": False,
        "live_home_xml_override_proven": False,
        "safe_to_flash": False,
    }

def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("owner_original_launcher_bin", type=Path)
    cli.add_argument("private_bench_candidate_bin", type=Path)
    args = cli.parse_args()
    print(json.dumps(patch(args.owner_original_launcher_bin, args.private_bench_candidate_bin), indent=2))
if __name__ == "__main__":
    main()
