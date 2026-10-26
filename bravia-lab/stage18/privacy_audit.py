#!/usr/bin/env python3
"""Read-only privacy audit for authored BRAVIA HOME sources.

This audit never connects to TV, disables a service or rewrites firmware.
It checks our own launcher and renderer for common tracking/network primitives;
it does NOT claim all proprietary Sony or third-party app traffic is covered.
"""
import argparse
import json
import re
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
RUNTIME = (
    "ui/launcher.js",
    "ui/app-data.js",
    "ui/sony_native_bridge.js",
    "ui/sony_catalog_bridge.js",
    "native_core/home_core.c",
    "native_core/host_dispatch.c",
    "native_core/render.c",
    "native_core/directfb_backend.c",
    "native_core/directfb_logos.c",
    "stage16/sim.c",
    "stage16/console.c",
)

# These are strict indicators in this local runtime, not a global classification
# of Sony DRM/OS services. We do not inspect third-party apps with this scanner.
NETWORK = {
    "fetch": r"\bfetch\s*\(",
    "xhr": r"\bXMLHttpRequest\b",
    "websocket": r"\bWebSocket\s*\(",
    "send_beacon": r"\bsendBeacon\s*\(",
    "eventsource": r"\bEventSource\s*\(",
    "js_socket": r"\brequire\s*\(\s*['\"](?:net|https?|dgram|dns)['\"]",
    "c_socket": r"\b(?:socket|connect|sendto|getaddrinfo|curl_easy_perform)\s*\(",
    "analytics_sdk": r"\b(?:mixpanel\.(?:init|track)|gtag|ga|fbq|amplitude\.track|analytics\.track)\s*\(",
}
POLICY = {
    "Samba ACR": {
        "source": "REAL_FIRMWARE_AUDIT.md / original v8.931 image",
        "observed": "Samba/CID relay client and settings present; factory default_setting.xml contains enabled=false",
        "current_tv_state": "UNKNOWN: live /3rd_rw/samba/acrsetting.xml not contained in OTA",
        "recommendation": "DISABLE_VIA_STOCK_PRIVACY_SETTINGS_IF_ENABLED",
        "safe_to_remove_firmware_component": False,
        "must_keep_tv_services": True,
    },
    "Samba Mixpanel": {
        "source": "REAL_FIRMWARE_AUDIT.md / bundled Samba consent interface",
        "observed": "mixpanel.init reference in /3rd/sony/samba/v1.0.9-sony.mtk.mtk/index.html",
        "current_tv_state": "UNKNOWN: static JS code alone does not prove execution or transmission",
        "recommendation": "REVIEW_SAMBA_OPT_OUT_AND_MEASURE_TRAFFIC",
        "safe_to_remove_firmware_component": False,
        "must_keep_tv_services": True,
    },
    "GloboPlay": {
        "source": "REAL_FIRMWARE_AUDIT.md / am_start.ini",
        "observed": "start_self=true; coexist dependencies recorded",
        "current_tv_state": "UNKNOWN: autostart configuration is not evidence of runtime network use",
        "recommendation": "DEPENDENCY_REVIEW_NO_AUTOMATIC_DISABLE",
        "safe_to_remove_firmware_component": False,
        "must_keep_tv_services": True,
    },
    "Sony Smart TV/DRM": {
        "source": "STAGE6_NATIVE_INSTALL_GATE.md / original app_man configs",
        "observed": "Sony streaming, browser, authentication/DRM and native TV services present",
        "current_tv_state": "UNKNOWN: no packet or live telemetry capture available",
        "recommendation": "PRESERVE_SMART_APPS_DRM_UPDATES_AND_NATIVE_TV",
        "safe_to_remove_firmware_component": False,
        "must_keep_tv_services": True,
    },
    "Third-party streaming applications": {
        "source": "config/app_catalog.json / user-planned app catalog",
        "observed": "Netflix, YouTube and other video apps are independent vendors",
        "current_tv_state": "UNKNOWN: no authenticated traffic measurement",
        "recommendation": "USER_INITIATED_LAUNCH_ONLY; vendor traffic is outside launcher privacy claims",
        "safe_to_remove_firmware_component": False,
        "must_keep_tv_services": False,
    },
}


def inspect_files(root=LAB, selected=RUNTIME):
    root = Path(root)
    findings = []
    checks = {name: re.compile(pattern) for name, pattern in NETWORK.items()}
    missing = []
    for rel in selected:
        file = root / rel
        if not file.is_file():
            missing.append(rel)
            continue
        data = file.read_text(encoding="utf-8")
        for name, rule in checks.items():
            for match in rule.finditer(data):
                line = data.count("\n", 0, match.start()) + 1
                findings.append({"file": rel, "line": line, "primitive": name})
    return {"mode": "READ_ONLY_NO_DEVICE_ACCESS",
            "scope": "FIRST_PARTY_RUNTIME_STATIC_SCAN_ONLY",
            "runtime_files_checked": len(selected) - len(missing),
            "unreadable_or_missing": missing,
            "findings": findings,
            "runtime_network_clean": not findings and not missing,
            "sony_proprietary_traffic_verified": False,
            "third_party_app_traffic_verified": False,
            "telemetry_disabled_on_physical_tv": False,
            "vendor_component_assessment": POLICY}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=LAB)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    report = inspect_files(args.root)
    body = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(body, encoding="utf-8")
    print(body, end="")
    return 0 if report["runtime_network_clean"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
