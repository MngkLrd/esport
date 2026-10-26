import sys
import tempfile
import unittest
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from elf_analyzer import ELFError,inspect_elf_bytes,inspect_elf_path
from inspect_sony import inspect,load_config
ARM_LIB=HERE.parent/"build"/"libbravia_home_armv7.so"
class SonyELFAuditTests(unittest.TestCase):
 def test_real_arm32_shared_object(self):
  info=inspect_elf_path(ARM_LIB)
  self.assertEqual(info["elf_type"],"ET_DYN")
  self.assertTrue(info["elf32_arm_eabi5"])
  self.assertEqual(info["soname"],"libbravia_home.so")
  self.assertEqual(info["dependencies"],[])
  self.assertTrue(any(s["name"]==".text" for s in info["sections"]))
  self.assertFalse(info["firmware_modified"])
  self.assertFalse(info["sony_abi_verified"])
 def test_wrong_or_truncated_elf_is_rejected(self):
  for raw in [b"",b"\x7fELF",b"not an ELF"*50,ARM_LIB.read_bytes()[:100]]:
   with self.subTest(length=len(raw)):
    with self.assertRaises(ELFError):inspect_elf_bytes(raw)
 def test_reject_unsupported_class_and_arch(self):
  raw=bytearray(ARM_LIB.read_bytes());raw[4]=2
  with self.assertRaises(ELFError):inspect_elf_bytes(bytes(raw))
  raw=bytearray(ARM_LIB.read_bytes());raw[18]=3
  with self.assertRaises(ELFError):inspect_elf_bytes(bytes(raw))
 def test_reject_tampered_ranges(self):
  raw=bytearray(ARM_LIB.read_bytes());raw[28:32]=(0xffffff00).to_bytes(4,'little')
  with self.assertRaises(ELFError):inspect_elf_bytes(bytes(raw))
 def test_report_no_oem_inputs_does_not_imply_installation(self):
  report=inspect()
  self.assertFalse(report["oem_inputs_all_sha_pinned"])
  self.assertFalse(report["verified_menu_configuration_route"])
  self.assertFalse(report["verified_sony_bootstrap"])
  self.assertFalse(report["verified_usb_custom_installer"])
  self.assertFalse(report["verified_on_device_restore"])
 def test_confusing_project_arm_module_with_oem_fails_pin(self):
  report=inspect(launcher=ARM_LIB)
  self.assertFalse(report["binaries"]["launcher.bin"]["oem_reference_trusted"])
  self.assertFalse(report["verified_sony_bootstrap"])
 def test_xml_has_no_implied_editability(self):
  with tempfile.TemporaryDirectory() as d:
   f=Path(d)/"DockUI.xml"
   f.write_text('<root><menu><app/><service/><entry/></menu></root>',encoding='utf-8')
   r=load_config(f,"xml")
   self.assertTrue(r["valid_xml"])
   self.assertEqual(r["menu_or_app_element_count"],4)
   self.assertEqual(r["can_reconfigure_stock_tiles"],"UNPROVEN")
   f.write_text('<!DOCTYPE foo [<!ENTITY x "boom">]><root>&x;</root>',encoding='utf-8')
   with self.assertRaises(ValueError):load_config(f,"xml")
 def test_config_does_not_export_source_or_device_id(self):
  with tempfile.TemporaryDirectory() as d:
   f=Path(d)/"am_config"
   f.write_text('private_token=SERIAL_PRIVATE\n/3rd/sony/sony_dockui/launcher.bin\n')
   r=load_config(f,"text")
   self.assertTrue(r["sony_dockui_path_reference"])
   self.assertNotIn('SERIAL_PRIVATE',str(r))
 def test_unsupported_symlinks_and_oversize(self):
  with tempfile.TemporaryDirectory() as d:
   target=Path(d)/"config.xml";target.write_text('<root/>')
   symlink=Path(d)/"link.xml";symlink.symlink_to(target)
   with self.assertRaises(ValueError):load_config(symlink,"xml")
   with self.assertRaises(ELFError):inspect_elf_path(symlink)
if __name__=='__main__': unittest.main(verbosity=2)
