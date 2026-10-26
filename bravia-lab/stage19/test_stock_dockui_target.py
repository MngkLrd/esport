"""Stage19 stock DockUI replacement policy invariant tests.

This is a non-flashable UI/host contract, not an OEM firmware edit.
"""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = Path(__file__).with_name("stock_dockui_target.json")

class DockUIReplacementPolicy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy = json.loads(TARGET.read_text(encoding="utf-8"))

    def test_legacy_apps_replaced_as_row_not_uninstalled(self):
        p=self.policy
        self.assertEqual(p["legacy_apps_policy"]["action"], "REPLACE_ENTIRE_LEGACY_APPLICATIONS_ROW")
        self.assertFalse(p["legacy_apps_policy"]["preserve_legacy_shortcuts"])
        self.assertFalse(p["legacy_apps_policy"]["remove_vendor_binaries"])
        self.assertEqual([item["section"] for item in p["desired_home_order"]],
                         ["applications","channels","media","settings"])

    def test_no_records_or_legacy_apps_visible(self):
        hidden=set(self.policy["hidden_from_home"])
        self.assertIn("recordings_section",hidden)
        self.assertIn("manual_recording_timer",hidden)
        self.assertIn("legacy_app_tiles",hidden)
        self.assertNotIn("channels",hidden)
        self.assertNotIn("settings",hidden)
        self.assertNotIn("media",hidden)

    def test_selected_ten_are_independent_of_original_app_row(self):
        apps=self.policy["desired_apps"]
        ids=[x["id"] for x in apps]
        self.assertEqual(ids, ["kinopoisk","ivi","start","netflix","youtube",
                               "rutube","mediax","alpac","browser","kion"])
        self.assertEqual(len(set(ids)),10)
        for app in apps:
            self.assertIn(app["launch"], {
                "VERIFY_EXISTING_SONY_NATIVE_IF_SUPPORTED",
                "REQUIRES_COMPATIBLE_SONY_CLIENT",
                "VERIFY_STOCK_SONY_BROWSER_INTENT",
            })
        self.assertIn("new tile remains a separately defined user entry",
                      self.policy["legacy_apps_policy"]["overlap_rule"])

    def test_channels_media_settings_have_host_only_intents(self):
        sections={x["section"]:x for x in self.policy["desired_home_order"]}
        self.assertEqual(sections["channels"]["mode"], "SONY_HOST_NATIVE")
        self.assertEqual(sections["media"]["mode"], "SONY_USB_MEDIA_NATIVE")
        self.assertEqual(sections["settings"]["mode"], "SONY_NATIVE_HANDOFF")
        required={
            "channels":{"program_list","guide","recent_channels","frequent_channels"},
            "media":{"usb_preview","photos","videos","music"},
            "settings":{"system","network","support","help"}
        }
        for name,expected in required.items():
            entries=sections[name]["items"]
            self.assertEqual({e["key"] for e in entries}, expected)
            self.assertTrue(all(e["intent"].startswith("SONY_") for e in entries))
            self.assertTrue(all(e["verified_on_hardware"] is False for e in entries))
        self.assertIn("never fabricate", sections["channels"]["items"][3]["fallback"])

    def test_system_below_home_is_never_removed(self):
        kept=set(self.policy["system_features_not_removed"])
        for critical in ("native_live_tv","tuner","epg","hdmi_input",
                         "volume_osd","picture_settings","audio_settings",
                         "options_key","back_key","drm","ota_and_recovery",
                         "usb_media_decoders","app_manager"):
            self.assertIn(critical, kept)

    def test_privacy_and_hardware_release_remain_blocked(self):
        p=self.policy
        self.assertEqual(p["privacy"]["samba_acr"], "STOCK_OPT_OUT_IF_ENABLED")
        self.assertIn("VALIDATED_APP_INSTALL_OR_LAUNCH_PATH",p["hardware_gates"])
        self.assertIn("VERIFIED_BACKUP_AND_RECOVERY_BEFORE_ANY_PROTECTED_PARTITION_WRITE",p["hardware_gates"])
        self.assertIn("HOME replacement",p["not_verified_real_tv"])
        self.assertIn("NOT a firmware update",p["launch_constraint"])

if __name__=="__main__":
    unittest.main(verbosity=2)
