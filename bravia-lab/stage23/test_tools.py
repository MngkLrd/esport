import tempfile
import unittest
import zipfile
from pathlib import Path
from stage23.installer_gate import assess,inspect_elf,inspect_zip,file_hash
from stage23.service_policy import audit

class Stage23ReleaseGates(unittest.TestCase):
    def test_unprovided_oem_never_becomes_installer(self):
        result=assess()
        self.assertFalse(result["safe_to_flash"])
        self.assertEqual(result["result"],"NO_INSTALLER")
        self.assertIn("NO_VERIFIED_SONY_NATIVE_EXECUTION_OR_INSTALL_PATH",result["blockers"])
        self.assertFalse(result["on_device_privacy_services_disabled"])

    def test_fake_signed_name_does_not_prove_oem(self):
        with tempfile.TemporaryDirectory() as d:
            file=Path(d)/"sony_tvupdate_2017_8931_eff_auth.zip"
            with zipfile.ZipFile(file,"w") as archive:
                archive.writestr("sony_dtv_FAKE/payload","not signed")
            evidence=inspect_zip(file)
            self.assertFalse(evidence["oem_reference_sha_match"])
            self.assertFalse(evidence["modified_usb_update_acceptance_proven"])

    def test_zip_traversal_detected_without_extraction(self):
        with tempfile.TemporaryDirectory() as d:
            file=Path(d)/"test.zip"
            with zipfile.ZipFile(file,"w") as archive:archive.writestr("../unsafe","x")
            self.assertIn("PATH_TRAVERSAL",inspect_zip(file)["archive_issues"])

    def test_symlinks_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            target=Path(d)/"a";target.write_bytes(b"x")
            link=Path(d)/"b";link.symlink_to(target)
            with self.assertRaises(ValueError):file_hash(link,100)

    def test_arm_so_is_not_original_sony_launcher(self):
        file=Path(__file__).resolve().parent/"build/libbravia_home_armv7.so"
        if not file.is_file():self.skipTest("ARM SO only generated during build")
        evidence=inspect_elf(file,"launcher")
        self.assertTrue(evidence["elf32_arm"])
        self.assertFalse(evidence["oem_reference_sha_match"])
        self.assertFalse(evidence["sony_callback_and_launch_abi_proven"])

    def test_debloat_preserves_tv_and_firmware(self):
        result=audit()
        self.assertEqual(len(result["new_home_application_labels"]),10)
        for item in ("dtv_svc","browser_base","app_man","ota","usb_media"):
            self.assertIn(item,result["keep_without_removal"])
        self.assertFalse(result["running_telemetry_or_cpu_verified"])
        self.assertTrue(all(not e["disable_now"]
                    for e in result["optional_candidates_review_only"].values()))

    def test_globoplay_config_is_only_a_candidate_not_measured_load(self):
        with tempfile.TemporaryDirectory() as d:
            config=Path(d)/"basic/am_start.ini"
            config.parent.mkdir()
            config.write_text("[globoplay]\nstart_self=true\n",encoding="utf-8")
            result=audit(d)
            self.assertTrue(result["sources_available"]["am_start.ini"])
            self.assertTrue(result["optional_candidates_review_only"]["globoplay"]["static_config_reference"])
            self.assertFalse(result["optional_candidates_review_only"]["globoplay"]["cpu_savings_proven"])
if __name__=="__main__":unittest.main(verbosity=2)
