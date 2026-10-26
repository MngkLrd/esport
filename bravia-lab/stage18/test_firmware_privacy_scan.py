import tempfile
import unittest
from pathlib import Path
from stage18.firmware_privacy_scan import observe

class FirmwarePrivacyScanTests(unittest.TestCase):
    def test_detects_static_samba_indicators_not_network_claim(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)/"root"
            third = Path(temp)/"3rdp"
            (root/"basic").mkdir(parents=True)
            (third/"samba").mkdir(parents=True)
            (third/"sony/samba").mkdir(parents=True)
            (root/"basic/am_start.ini").write_text("globoplay\nstart_self=true\n", encoding="utf-8")
            (third/"samba/default_setting.xml").write_text(
                "<default><enabled>false</enabled></default>", encoding="utf-8")
            (third/"samba/cidclient").write_bytes(b"\0\0\0")
            (third/"sony/samba/index.html").write_text(
                "<script>mixpanel.init('REDACTED')</script>", encoding="utf-8")
            r = observe({"root": root, "3rdp": third})
            self.assertTrue(r["indicators"]["samba_component_present"])
            self.assertTrue(r["indicators"]["samba_factory_default_disabled"])
            self.assertTrue(r["indicators"]["mixpanel_reference_present"])
            self.assertTrue(r["indicators"]["globoplay_autostart_reference"])
            self.assertEqual(r["runtime_tv_state"], "UNKNOWN")
            self.assertFalse(r["network_traffic_confirmed"])
            self.assertFalse(r["telemetry_disabled_on_tv"])
            text = str(r)
            self.assertNotIn("REDACTED", text)

    def test_symlinks_not_followed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)/"root"
            root.mkdir()
            private = Path(tmp)/"private"
            private.write_text("mixpanel.init('PRIVATE')", encoding="utf-8")
            (root/"samba-private.js").symlink_to(private)
            r = observe({"root": root})
            self.assertEqual(r["candidate_count"], 0)
            self.assertEqual(r["skipped_symlink_files"], 1)
            self.assertFalse(r["indicators"]["mixpanel_reference_present"])

    def test_missing_root_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                observe({"root": Path(tmp)/"missing"})

    def test_garbage_text_not_claimed_active(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/"telemetry-test.txt").write_text("some data", encoding="utf-8")
            r = observe({"root": root})
            self.assertEqual(r["candidate_count"], 1)
            self.assertEqual(r["candidates"][0]["runtime_active"], "UNKNOWN")
            self.assertFalse(r["network_traffic_confirmed"])

    def test_non_candidate_binary_ignored(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/"random.so").write_bytes(b"mixpanel.init")
            r = observe({"root": root})
            self.assertEqual(r["candidate_count"], 0)
            self.assertFalse(r["indicators"]["mixpanel_reference_present"])

if __name__ == "__main__":
    unittest.main(verbosity=2)
