#!/usr/bin/env python3
"""Deterministic offline-only delivery bundle safety checks."""
import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from stage18.package_offline import approved_paths, bundle, safe_manifest

class OfflinePackTests(unittest.TestCase):
    def test_source_inventory_integrity(self):
        paths = approved_paths(include_generated=False)
        self.assertEqual(paths, sorted(set(paths)))
        self.assertIn("bravia-lab/native_core/home_core.c", paths)
        self.assertIn("bravia-lab/stage18/privacy_audit.py", paths)
        self.assertIn("bravia-lab/stage18/PRIVACY_PRODUCT_POLICY.md", paths)
        self.assertIn(".github/workflows/bravia-home-ci.yml", paths)

    def test_untracked_private_file_is_not_packaged(self):
        # Deliberately place a local-only JSON in the Stage18 work directory.
        workdir = Path(__file__).resolve().parent
        private = workdir / "_temporary_private_test_data.json"
        self.assertFalse(private.exists())
        try:
            private.write_text('{"token":"must-not-ship"}', encoding="utf-8")
            self.assertNotIn("bravia-lab/stage18/" + private.name,
                             approved_paths(include_generated=True))
        finally:
            private.unlink(missing_ok=True)

    def test_disallow_vendor_executables_and_ota(self):
        paths = approved_paths()
        prohibited = (".zip", ".pkg", ".bin", ".so", ".elf", ".o", ".key", ".pem",
                      ".p12", ".img", ".squashfs")
        self.assertFalse(any(p.lower().endswith(prohibited) for p in paths))
        self.assertFalse(any("/.git/" in p or "/__pycache__/" in p for p in paths))

    def test_manifest_matches_real_files(self):
        records = safe_manifest(include_generated=False)
        self.assertGreaterEqual(len(records), 99)
        self.assertEqual(len({x["path"] for x in records}), len(records))
        self.assertTrue(all(x["bytes"] <= 8 * 1024 * 1024 for x in records))

    def test_reproducible_zip_and_no_flash_label(self):
        with tempfile.TemporaryDirectory() as tmp:
            a = Path(tmp) / "a.zip"
            b = Path(tmp) / "b.zip"
            m = bundle(a, include_generated=False)
            bundle(b, include_generated=False)
            self.assertEqual(hashlib.sha256(a.read_bytes()).digest(),
                             hashlib.sha256(b.read_bytes()).digest())
            self.assertFalse(m["safe_to_flash"])
            self.assertFalse(m["contains_sony_firmware"])
            self.assertFalse(m["contains_oem_binary_or_drm"])
            with zipfile.ZipFile(a) as archive:
                self.assertIsNone(archive.testzip())
                names = archive.namelist()
                self.assertEqual(len(names), len(set(names)))
                self.assertIn("README_OFFLINE.txt", names)
                self.assertIn("SHA256_MANIFEST.json", names)
                self.assertIn("NOT INSTALLABLE", archive.read("README_OFFLINE.txt").decode())
                actual = json.loads(archive.read("SHA256_MANIFEST.json"))
                self.assertEqual(actual["file_count"], len(actual["files"]))
                self.assertEqual(actual["origin_migration_files"], 99)
                for record in actual["files"]:
                    self.assertEqual(hashlib.sha256(archive.read(record["path"])).hexdigest(),
                                     record["sha256"])

if __name__ == "__main__":
    unittest.main(verbosity=2)
