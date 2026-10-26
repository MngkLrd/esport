import subprocess
import sys
import unittest
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
BUILD=HERE/"build"
sys.path.insert(0,str(HERE))
from elf_analyzer import inspect_elf_path
class NativeExecutableChecks(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  subprocess.run(['sh',str(HERE/'build_probe.sh')],cwd=ROOT,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
 def test_host_executes_same_plugin_graph(self):
  x=subprocess.check_output([str(BUILD/'native_boot_probe_host')],text=True)
  self.assertIn('NATIVE_CORE_PASS 94 UI commands',x)
 def test_actual_arm_exec_not_just_relocatable_object(self):
  report=inspect_elf_path(BUILD/'bravia_home_native_probe_armv7.elf')
  self.assertEqual(report['elf_type'],'ET_EXEC')
  self.assertTrue(report['elf32_arm_eabi5'])
  self.assertIsNone(report['interpreter'])
  self.assertEqual(report['dependencies'],[])
  self.assertFalse(report['sony_abi_verified'])
  self.assertFalse(report['runtime_exec_proven'])
 def test_shared_arm_has_no_vendor_dependency(self):
  lib=inspect_elf_path(ROOT/'stage23/build/libbravia_home_armv7.so')
  self.assertEqual(lib['elf_type'],'ET_DYN')
  self.assertEqual(lib['dependencies'],[])
  self.assertFalse(lib['oem_reference_trusted'])
 def test_linux_only_syscalls_not_sony(self):
  source=(HERE/'native_boot_probe.c').read_text()+(HERE/'native_boot_start.S').read_text()
  for prohibited in ('am_client_init(', 'am_send_cmd(', '/dev/mmcblk', 'fw_setenv(', 'system(', 'curl_', 'socket('):
   with self.subTest(p=prohibited):self.assertNotIn(prohibited,source)
if __name__=='__main__':unittest.main(verbosity=2)
