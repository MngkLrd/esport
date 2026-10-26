"""Stage21 version/provenance guard is strictly read-only and fail-closed."""
import tempfile
import unittest
from pathlib import Path
from stage21.firmware_preflight import (
    REPORTED_TV_VERSION, classify_version, probe, sha256_bounded,
)

class FirmwareVersionGate(unittest.TestCase):
    def test_reported_version_is_correct_major_family_only(self):
        self.assertEqual(classify_version(REPORTED_TV_VERSION),
                         "RESEARCH_VERSION_FAMILY_MATCH_ONLY")
        report=probe(REPORTED_TV_VERSION)
        self.assertFalse(report["tv_suffix_byte_match_verified"])
        self.assertFalse(report["sony_loader_verified"])
        self.assertFalse(report["firmware_write_permitted"])
        self.assertFalse(report["tv_live_files_examined"])
        self.assertEqual(report["next_step"],
                         "NEED_PRIVATE_OEM_HASHES_FOR_BUILD_ID_CONFIRMATION")
        self.assertTrue(all(not r["provided"] for r in report["files"].values()))

    def test_mismatched_version_is_stop(self):
        for bad in ("8.933-1000-4.000-0000", "8.932-1000-4.000-0000",
                    "8.931-1001-4.000-0000", "8.931", "", "8.931-1000-X"):
            with self.subTest(bad=bad):
                self.assertNotEqual(classify_version(bad),
                                    "RESEARCH_VERSION_FAMILY_MATCH_ONLY")
                self.assertEqual(probe(bad)["next_step"], "STOP_WRONG_FIRMWARE")

    def test_suffix_changed_is_only_family_match_not_bitwise_verification(self):
        r=probe("8.931-1000-9.999-9999")
        self.assertEqual(r["version_verdict"], "RESEARCH_VERSION_FAMILY_MATCH_ONLY")
        self.assertFalse(r["tv_suffix_byte_match_verified"])

    def test_unpinned_original_files_never_claimed_valid(self):
        with tempfile.TemporaryDirectory() as td:
            fake=Path(td)/"launcher.bin"
            fake.write_bytes(b"fake ELF DockUI.xml libapp_client.so")
            r=probe(REPORTED_TV_VERSION,launcher=fake)
            self.assertFalse(r["files"]["launcher.bin"]["pin_match"])
            self.assertIsNone(r["files"]["launcher.bin"]["indicators"])
            self.assertFalse(r["firmware_write_permitted"])
            self.assertEqual(r["next_step"],
                             "NEED_PRIVATE_OEM_HASHES_FOR_BUILD_ID_CONFIRMATION")

    def test_no_symlink_or_huge_oem_files(self):
        with tempfile.TemporaryDirectory() as td:
            file=Path(td)/"data"
            file.write_bytes(b"sample")
            link=Path(td)/"link"
            link.symlink_to(file)
            with self.assertRaises(ValueError):
                sha256_bounded(link, 100)
            with self.assertRaises(ValueError):
                sha256_bounded(file, 1)
            self.assertEqual(len(sha256_bounded(file, 100)), 64)

    def test_output_does_not_include_oem_file_paths_or_contents(self):
        with tempfile.TemporaryDirectory() as td:
            fake=Path(td)/"PRIVATE_DEVICE_ID"
            fake.write_bytes(b"SENSITIVE PERSONAL DATA")
            r=probe(REPORTED_TV_VERSION, app_man=fake)
            self.assertNotIn("PRIVATE_DEVICE_ID",str(r))
            self.assertNotIn("SENSITIVE PERSONAL DATA",str(r))

if __name__ == "__main__":
    unittest.main(verbosity=2)
