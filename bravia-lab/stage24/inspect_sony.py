#!/usr/bin/env python3
"""Offline KD-55XG7096 / Sony v8.931 native DockUI integration audit.

Owner-provided OEM inputs remain local. Does not open TV connections,
create updates, patch binary, guess IPC or print original file bodies.
"""
from __future__ import annotations
import argparse
import json
import hashlib
from pathlib import Path
from xml.etree import ElementTree
from elf_analyzer import ELFError, PINNED, inspect_elf_path

MODEL = "KD-55XG7096"
TV_VERSION = "8.931-1000-4.000-0000"
STOCK_PATH = "/3rd/sony/sony_dockui/launcher.bin"
MAX_CONFIG = 2 * 1024 * 1024
ALLOWED = frozenset(("launcher.bin", "app_man", "libapp_client.so"))


def load_config(path: Path | None, fmt: str) -> dict:
    if path is None:
        return {"provided": False}
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_CONFIG:
        raise ValueError("Invalid or oversized OEM configuration input")
    data = path.read_bytes()
    result = {"provided": True, "bytes": len(data),
              "sha256_16": hashlib.sha256(data).hexdigest()[:16]}
    if fmt == "xml":
        if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
            raise ValueError("XML external entity / DTD input rejected")
        root = ElementTree.fromstring(data)
        if sum(1 for _ in root.iter()) > 20000:
            raise ValueError("XML exceeds bounded element limit")
        labels = []
        for el in root.iter():
            label = el.tag.split("}")[-1].lower()
            if label in ("app", "service", "item", "application", "menu", "entry"):
                labels.append(label)
        result.update({"valid_xml": True,
                       "menu_or_app_element_count": len(labels),
                       "menu_element_counts": {x: labels.count(x) for x in sorted(set(labels))},
                       "can_reconfigure_stock_tiles": "UNPROVEN"})
    else:
        text = data.decode("utf-8", "replace").lower()
        result.update({"sony_dockui_path_reference": STOCK_PATH.lower() in text,
                       "service_list_reference": "service_list" in text,
                       "app_manager_reference": "app_man" in text,
                       "legacy_app_names": {x: x.lower() in text for x in (
                           "Netflix", "YouTube", "Amazon", "browser_base", "globoplay")},
                       "can_reconfigure_stock_tiles": "UNPROVEN"})
    return result


def inspect(launcher: Path | None = None, app_manager: Path | None = None,
            client_library: Path | None = None, am_config: Path | None = None,
            dockui_xml: Path | None = None, am_start: Path | None = None) -> dict:
    candidates = {"launcher.bin":launcher, "app_man":app_manager,
                  "libapp_client.so":client_library}
    binaries = {}
    for name, path in candidates.items():
        binaries[name] = {"provided":False} if path is None else inspect_elf_path(path, PINNED[name])
    configs = {
       "am_config":load_config(am_config,"text"),
       "am_start.ini":load_config(am_start,"text"),
       "DockUI.xml":load_config(dockui_xml,"xml")
    }
    matching = all(binaries[name].get("oem_reference_trusted") is True for name in ALLOWED)
    launcher_evidence = binaries["launcher.bin"]
    deps = set(launcher_evidence.get("dependencies",[]))
    has_stock_native_links = matching and {"libapp_client.so", "libdirectfb.so"}.issubset(deps)
    config_candidate = bool(configs["DockUI.xml"].get("provided") or configs["am_config"].get("provided"))
    return {
      "model": MODEL, "tv_reported_version": TV_VERSION,
      "scan_type": "OWNER_LOCAL_READ_ONLY_OEM_FILES",
      "oem_inputs_all_sha_pinned": matching,
      "launcher_native_library_imports_verified": has_stock_native_links,
      "configs_supplied": config_candidate,
      "binaries": binaries, "configs": configs,
      "verified_menu_configuration_route": False,
      "verified_sony_bootstrap": False,
      "verified_usb_custom_installer": False,
      "verified_on_device_restore": False,
      "unsigned_firmware_flash_recommended": False,
      "status": "OFFLINE_EVIDENCE_ONLY" if matching else "NEED_EXACT_ORIGINAL_OEM_FILES",
      "next_high_value_work": [
          "Trace launcher.bin calls referencing DockUI.xml and service_list using a real disassembler on the pinned OEM ELF",
          "Identify exact stock app manager service identifiers and reversible launch/focus API",
          "Link the native Stage23 ARM HOME module to a validated Sony graphics and lifecycle host",
          "Build a genuine Sony accepted update only after loader verification and device-specific recovery"
      ],
      "note": "A string hit, XML record, or ELF import is not proof the OEM loader uses user-modified data."
    }


def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--launcher",type=Path)
    ap.add_argument("--app-manager",type=Path)
    ap.add_argument("--client-library",type=Path)
    ap.add_argument("--am-config",type=Path)
    ap.add_argument("--dockui-xml",type=Path)
    ap.add_argument("--am-start",type=Path)
    ap.add_argument("--report",type=Path)
    a=ap.parse_args(argv)
    result=inspect(a.launcher,a.app_manager,a.client_library,
                   a.am_config,a.dockui_xml,a.am_start)
    output=json.dumps(result,ensure_ascii=False,indent=2)+"\n"
    if a.report:
        a.report.parent.mkdir(parents=True,exist_ok=True)
        a.report.write_text(output,encoding="utf-8")
    print(output,end="")
    return 0 if result["oem_inputs_all_sha_pinned"] else 3

if __name__=="__main__":
    try: raise SystemExit(main())
    except (OSError,ValueError,ELFError,ElementTree.ParseError) as e:
        print("OEM audit failed: "+str(e),file=__import__('sys').stderr)
        raise SystemExit(2)
