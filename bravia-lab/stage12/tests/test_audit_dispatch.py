import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('audit_dispatch',ROOT/'audit_dispatch.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
OEM=Path(os.environ.get('BRAVIA_SONY_OEM_ELF_DIR','/mnt/data/BRAVIA_STAGE11/private'))
class TestSonyArm(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.lib=OEM/'libapp_client.so';cls.dock=OEM/'launcher.bin';cls.manager=OEM/'app_man'
  if not all(x.exists() for x in (cls.lib,cls.dock,cls.manager)):
   raise unittest.SkipTest('Set BRAVIA_SONY_OEM_ELF_DIR to a private directory containing owner original ELF files')
  cls.result=mod.audit(cls.lib,cls.dock,cls.manager)
 def test_twenty_real_checks(self):self.assertEqual((self.result['passed'],self.result['total']),(20,20))
 def test_all_true(self):self.assertTrue(all(self.result['checks'].values()))
 def test_127_bound(self):self.assertTrue(self.result['checks']['read_127_bytes'])
 def test_two_relay_calls(self):
  self.assertTrue(self.result['checks']['relay_receive_path_one'])
  self.assertTrue(self.result['checks']['relay_receive_path_two'])
 def test_callback_parser_separate(self):self.assertTrue(self.result['checks']['event_parser_separate_from_relay'])
 def test_zero_third_arg(self):self.assertTrue(self.result['checks']['ordinary_callback_zeroes_r2'])
 def test_fallback_third_arg(self):self.assertTrue(self.result['checks']['generic_callback_forwards_r2'])
 def test_special_offset56_is_untrusted(self):
  self.assertEqual(self.result['special_callback_offset'],56)
  self.assertFalse(self.result['callback_C_prototypes_verified'])
 def test_original_hashes(self):
  for label,fn in [('lib',self.lib),('dock',self.dock),('manager',self.manager)]:mod.verify(fn,label)
 def test_tamper_library_fails(self):
  with tempfile.TemporaryDirectory() as d:
   v=bytearray(self.lib.read_bytes());v[0x1d78]^=0xff
   f=Path(d)/'lib.so';f.write_bytes(v)
   with self.assertRaisesRegex(ValueError,'SHA256'):mod.audit(f,self.dock,self.manager)
 def test_tamper_manager_fails(self):
  with tempfile.TemporaryDirectory() as d:
   v=bytearray(self.manager.read_bytes());v[0x100]^=1
   f=Path(d)/'manager';f.write_bytes(v)
   with self.assertRaisesRegex(ValueError,'SHA256'):mod.audit(self.lib,self.dock,f)
 def test_truncated_dock_fails(self):
  with tempfile.TemporaryDirectory() as d:
   f=Path(d)/'dock';f.write_bytes(self.dock.read_bytes()[:100])
   with self.assertRaisesRegex(ValueError,'SHA256'):mod.audit(self.lib,f,self.manager)
 def test_no_hardware_call(self):self.assertFalse(self.result['hardware_tested'])
 def test_no_flashable_output(self):self.assertFalse(self.result['flashable'])
 def test_no_unverified_inbound_framing(self):self.assertFalse(self.result['actual_inbound_framing_verified'])
 def test_output_serializable(self):self.assertEqual(json.loads(json.dumps(self.result))['passed'],20)
 def test_read_only_sources(self):
  s=(ROOT/'audit_dispatch.py').read_text()
  for bad in ('subprocess.Popen(', 'socket.socket(', 'ssh ', 'open("/dev/'):self.assertNotIn(bad,s)
if __name__=='__main__':unittest.main(verbosity=2)
