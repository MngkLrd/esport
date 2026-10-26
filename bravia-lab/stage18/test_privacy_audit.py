#!/usr/bin/env python3
"""Stage18.2: privacy limits and fail-closed static scanning regression."""
import json
import tempfile
import unittest
from pathlib import Path
from stage18.privacy_audit import RUNTIME, NETWORK, inspect_files

LAB = Path(__file__).resolve().parents[1]

class PrivacyAuditTests(unittest.TestCase):
    def test_first_party_runtime_has_no_common_network_or_analytics_calls(self):
        report = inspect_files()
        self.assertTrue(report["runtime_network_clean"], report["findings"])
        self.assertEqual(report["runtime_files_checked"], len(RUNTIME))
        self.assertEqual(report["unreadable_or_missing"], [])

    def test_privacy_report_never_claims_sony_or_vendor_device_state(self):
        r = inspect_files()
        self.assertFalse(r["sony_proprietary_traffic_verified"])
        self.assertFalse(r["third_party_app_traffic_verified"])
        self.assertFalse(r["telemetry_disabled_on_physical_tv"])
        self.assertEqual(r["mode"], "READ_ONLY_NO_DEVICE_ACCESS")

    def test_samba_factory_default_not_confused_with_live_setting(self):
        r = inspect_files()
        samba = r["vendor_component_assessment"]["Samba ACR"]
        self.assertIn("enabled=false", samba["observed"])
        self.assertIn("UNKNOWN", samba["current_tv_state"])
        self.assertFalse(samba["safe_to_remove_firmware_component"])

    def test_core_services_are_never_marked_for_deletion(self):
        for component in inspect_files()["vendor_component_assessment"].values():
            self.assertFalse(component["safe_to_remove_firmware_component"])
        self.assertIn("PRESERVE", inspect_files()["vendor_component_assessment"]["Sony Smart TV/DRM"]["recommendation"])

    def test_scan_detects_injected_analytics_or_network_calls(self):
        probes = [
            ("fetch('https://telemetry.invalid')", "fetch"),
            ("new XMLHttpRequest()", "xhr"),
            ("new WebSocket('wss://tracking.invalid')", "websocket"),
            ("navigator.sendBeacon('/usage', '{}')", "send_beacon"),
            ("mixpanel.track('watch')", "analytics_sdk"),
            ("socket(AF_INET, SOCK_STREAM, 0);", "c_socket"),
        ]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            file = root / "tracked.js"
            for snippet, expected in probes:
                with self.subTest(expected=expected):
                    file.write_text(snippet, encoding="utf-8")
                    report = inspect_files(root, ("tracked.js",))
                    self.assertFalse(report["runtime_network_clean"])
                    self.assertEqual([f["primitive"] for f in report["findings"]], [expected])

    def test_missing_source_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = inspect_files(tmp, ("absent.js",))
            self.assertFalse(report["runtime_network_clean"])
            self.assertEqual(report["unreadable_or_missing"], ["absent.js"])

    def test_csp_blocks_home_page_network_not_sony_native_intents(self):
        content = (LAB / "ui/index.html").read_text(encoding="utf-8")
        self.assertIn("connect-src 'none'", content)
        self.assertIn("frame-src 'none'", content)
        self.assertIn("referrer", content.lower())
        self.assertIn('sony_catalog_bridge.js', content)

if __name__ == "__main__":
    unittest.main(verbosity=2)
