#!/usr/bin/env python3
"""Stage18.1 source-preservation and CI-coverage gate (offline, no Sony hardware)."""
import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
LAB = HERE.parent
REPO = LAB.parent
INVENTORY = HERE / "source_inventory.json"

class SourcePreservationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(INVENTORY.read_text(encoding="utf-8"))

    def test_all_99_migrated_paths_present(self):
        self.assertEqual(self.manifest["origin_bravialab_file_count"], 99)
        paths = self.manifest["source_files"]
        self.assertEqual(len(paths), 99)
        self.assertEqual(len(set(paths)), 99)
        self.assertTrue(all(p.startswith("bravia-lab/") for p in paths))
        missing = [str(p) for p in paths if not (REPO / p).is_file()]
        self.assertEqual(missing, [], "Migrated files lost or renamed")

    def test_original_migration_provenance(self):
        self.assertEqual(self.manifest["origin_repository"], "MngkLrd/game")
        self.assertEqual(self.manifest["origin_branch"], "bravia-firmware-lab")
        self.assertEqual(self.manifest["origin_commit"],
                         "9418fe38df51b84708170d35de0948985612b65a")

    def test_stage15_through_17_are_not_missing(self):
        required = (
            "stage15/build.sh", "stage15/demo_core.c", "stage15/arm_linux_io.c",
            "stage16/sim.c", "stage16/console.c", "stage16/build_arm.sh",
            "stage17/build_assets.py", "stage17/generate_assets.py",
            "stage17/build_preview.py", "stage17/test_logo_assets.py",
            "stage17/test_assets.py", "native_core/directfb_logos.c",
            "native_core/directfb_logos.h", "tests/test_directfb_logo_loader.c",
            "stage18/privacy_audit.py", "stage18/test_privacy_audit.py",
            "stage18/firmware_privacy_scan.py", "stage18/test_firmware_privacy_scan.py",
            "stage18/package_offline.py", "stage18/test_package_offline.py",
            "stage18/test_browser_privacy.py", "stage18/PRIVACY_PRODUCT_POLICY.md",
        )
        self.assertEqual([p for p in required if not (LAB / p).is_file()], [])

    def test_ci_preserves_source_browser_abi_and_lifecycle_coverage(self):
        workflow = (REPO / ".github/workflows/bravia-home-ci.yml").read_text(encoding="utf-8")
        for text in ("test_ui_v2_browser.py", "test_native_sony_browser.py",
                     "test_catalog_browser.py", "stage8/sony_appclient_abi.c",
                     "stage9/test_lifecycle.c", "test_repo_integrity.py",
                     "test_logo_assets.py", "test_assets.py", "adapter-test",
                     "test_privacy_audit.py", "test_firmware_privacy_scan.py",
                     "test_package_offline.py", "test_browser_privacy.py"):
            with self.subTest(name=text):
                self.assertIn(text, workflow)

    def test_stage17_asset_entrypoints_share_one_generator(self):
        legacy = (LAB / "stage17/generate_assets.py").read_text(encoding="utf-8")
        canonical = (LAB / "stage17/build_assets.py").read_text(encoding="utf-8")
        self.assertIn("from build_assets import main", legacy)
        self.assertIn("STATES={'unknown':(.14,3.4),'ready':(.22,2.6),'unavailable':(.08,5.8)}", canonical)
        self.assertIn("30 preblurred", canonical)

    def test_sony_installation_gate_still_explicit(self):
        docs = (LAB / "STAGE13_INSTALL_RECOVERY_GATE.md").read_text(encoding="utf-8")
        self.assertIn("NO-GO", docs)
        self.assertIn("NOT VERIFIED", docs)

if __name__ == "__main__":
    unittest.main(verbosity=2)
