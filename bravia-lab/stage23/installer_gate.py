#!/usr/bin/env python3
"""Stage23: read-only Sony 8.931 ZIP/ELF integration feasibility report.

No ZIP extraction, device access, OTA patching, signature handling or writing.
An offline OEM SHA match is not a live firmware/loader proof.
"""
import argparse
import hashlib
import json
import re
import stat
import subprocess
import zipfile
from pathlib import Path

TV_VERSION = "8.931-1000-4.000-0000"
ORIGINAL_OTA_SHA256 = "9fedce4521bb3b9d2fc0d8e8a19d31a795752026d1a17249b1ccf712c25b606c"
ELF_SHA256 = {
 "launcher": "1c29e9f4175e825500b57874b37c5257fd8ce162b53ca061cc43a47e8c579480",
 "app_manager": "29fca75522ccd66abba528b8622ccda944e6b15455dd812c1f2036d710c14702",
 "client_library": "bbe9eb3d74c8e793b5d93e0a96edbb4d1e89fe8b3e259791c95b5836c3eb8636"
}
NEEDED = ("libdirectfb.so", "libapp_client.so", "libpng12.so.0",
          "libfreetype.so.6", "libexpat.so.1")

def file_hash(path, max_bytes):
    p = Path(path)
    if not p.is_file() or p.is_symlink() or p.stat().st_size > max_bytes:
        raise ValueError("unreadable, oversized or linked OEM input")
    digest = hashlib.sha256()
    with p.open("rb") as stream:
        while True:
            b = stream.read(1_048_576)
            if not b: break
            digest.update(b)
    return digest.hexdigest()

def inspect_zip(path):
    digest = file_hash(path, 400_000_000)
    problems, total, names = [], 0, set()
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if len(entries) > 30000: problems.append("TOO_MANY_MEMBERS")
        for item in entries:
            name = item.filename
            if name.startswith(("/", "\\")) or "\\" in name or ".." in name.split("/"):
                problems.append("PATH_TRAVERSAL")
            if name in names: problems.append("DUPLICATE_NAME")
            names.add(name)
            if item.flag_bits & 1: problems.append("ENCRYPTED_MEMBER")
            if stat.S_ISLNK(item.external_attr >> 16): problems.append("LINKED_MEMBER")
            if item.file_size > (item.compress_size + 1)*1000:
                problems.append("ZIP_BOMB_RISK")
            total += item.file_size
            if total > 8_000_000_000:
                problems.append("EXPANSION_OVER_LIMIT")
                break
        return {
         "provided": True, "oem_reference_sha_match": digest == ORIGINAL_OTA_SHA256,
         "member_count": len(entries), "total_expanded_bytes": total,
         "archive_issues": sorted(set(problems)),
         "modified_usb_update_acceptance_proven": False
        }

def inspect_elf(path, key):
    digest = file_hash(path, 70_000_000)
    def elf(*opts):
        r = subprocess.run(["readelf", "-W", *opts, str(path)], check=False,
                           capture_output=True, text=True, timeout=15)
        if r.returncode: raise ValueError("invalid ELF; readelf failed")
        return r.stdout
    header, dynamic = elf("-h"), elf("-d")
    names = sorted(set(re.findall(r"\(NEEDED\).*?\[(.*?)\]", dynamic)))
    return {
      "provided": True, "oem_reference_sha_match": digest == ELF_SHA256[key],
      "elf32_arm": "Class:                             ELF32" in header and
                   bool(re.search(r"Machine:\s*ARM",header)),
      "eabi5": "Version5 EABI" in header,
      "linked_libraries": names,
      "sony_native_dependencies": {name: name in names for name in NEEDED},
      "sony_callback_and_launch_abi_proven": False
    }

def assess(ota=None, launcher=None, app_manager=None, client_library=None):
    paths = {"ota":ota, "launcher":launcher,
             "app_manager":app_manager, "client_library":client_library}
    evidence = {}
    for name, path in paths.items():
        evidence[name] = ({"provided":False} if path is None
                          else inspect_zip(path) if name=="ota"
                          else inspect_elf(path,name))
    original_elves = all(evidence[name].get("oem_reference_sha_match") and
                         evidence[name].get("elf32_arm") for name in ELF_SHA256)
    original_ota = evidence["ota"].get("oem_reference_sha_match") is True
    blockers = [
      "NO_VERIFIED_SONY_NATIVE_EXECUTION_OR_INSTALL_PATH",
      "SONY_LIBAPP_CLIENT_CALLBACK_AND_APP_MANAGER_ABI_NOT_COMPLETE",
      "NO_PROVEN_MODIFIED_OTA_SIGNATURE_ACCEPTANCE",
      "NO_PROVEN_FULL_EMMC_BACKUP_AND_RECOVERY",
      "NEW_10_APP_BINARIES_AND_DRM_NOT_PORTED",
    ]
    if not original_ota: blockers.insert(0,"OFFICIAL_OTA_NOT_VERIFIED_LOCALLY")
    if not original_elves: blockers.insert(0,"OEM_ELF_REFERENCES_NOT_VERIFIED_LOCALLY")
    return {
      "result":"NO_INSTALLER",
      "target_model":"KD-55XG7096", "tv_reported_version":TV_VERSION,
      "offline_oem_ota_verified":original_ota,
      "offline_oem_elves_verified":original_elves,
      "on_device_binary_match_verified":False,
      "on_device_privacy_services_disabled":False,
      "safe_to_flash":False, "evidence":evidence,
      "blockers":blockers
    }

def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ota", type=Path)
    p.add_argument("--launcher", type=Path)
    p.add_argument("--app-manager", type=Path)
    p.add_argument("--client-library", type=Path)
    p.add_argument("--json", type=Path)
    a=p.parse_args(argv)
    report=assess(a.ota,a.launcher,a.app_manager,a.client_library)
    payload=json.dumps(report,ensure_ascii=False,indent=2)+"\n"
    if a.json:
        a.json.parent.mkdir(parents=True,exist_ok=True)
        a.json.write_text(payload,encoding="utf-8")
    print(payload,end="")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
