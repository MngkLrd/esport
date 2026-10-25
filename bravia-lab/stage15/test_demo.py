#!/usr/bin/env python3
"""Offline host/ARM ELF regression tests (no Sony hardware, no device writes)."""
import os
import re
import shutil
import subprocess
import unittest
from pathlib import Path
HERE=Path(__file__).resolve().parent
HOST=HERE/'build/bravia-home-linux-x86_64'
ARM=HERE/'build/bravia-home-armv7-linux-elf'

def run(keys):
    return subprocess.run([str(HOST)],input=keys,text=True,capture_output=True,timeout=12,check=True).stdout

class BraviaDemoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(['sh',str(HERE/'build.sh')],check=True,timeout=25,capture_output=True,text=True)
    def test_binary_is_real_linux_elf(self):
        self.assertEqual(HOST.read_bytes()[:4],b'\x7fELF')
        self.assertEqual(ARM.read_bytes()[:4],b'\x7fELF')
    def test_arm_is_executable_not_relocatable(self):
        out=subprocess.check_output(['readelf','-h',str(ARM)],text=True)
        for token in ('ELF32','EXEC (Executable file)','ARM','Version5 EABI'):self.assertIn(token,out)
        self.assertNotIn('REL (Relocatable file)',out)
    def test_arm_is_not_using_dynamic_loader(self):
        out=subprocess.check_output(['readelf','-W','-l',str(ARM)],text=True)
        self.assertNotIn('INTERP',out)
        self.assertNotIn('DYNAMIC',out)
    def test_arm_symbols_resolved(self):
        out=subprocess.check_output(['readelf','-W','-s',str(ARM)],text=True)
        self.assertEqual([], [s for s in out.splitlines() if re.search(r'\bUND\b',s) and not re.search(r'\bLOCAL\b',s) and not s.rstrip().endswith(' UND ')])
    def test_tv_draws_nothing(self):self.assertIn('view=tv area=tv-card focus=0 selected=none feedback=0 draw=0',run('q'))
    def test_home_has_native_draw_commands(self):self.assertIn('view=home area=tv-card focus=0 selected=none feedback=0 draw=94',run('hq'))
    def test_down_focus_first_app(self):self.assertIn('view=home area=apps focus=0',run('hsq'))
    def test_right_focus_second_app(self):self.assertIn('view=home area=apps focus=1',run('hsdq'))
    def test_app_open_fails_without_sony_host(self):
        s=run('hsoq');self.assertIn('NO_SONY_HOST_ACTION',s)
        self.assertIn('view=detail area=apps focus=0 selected=0 feedback=3',s)
    def test_unknown_app_is_not_claimed_ready(self):self.assertNotIn('APP_LAUNCHED',run('hsoq'))
    def test_back_restores_home(self):self.assertIn('view=home area=apps focus=0 selected=none',run('hsobq'))
    def test_back_to_tv_fails_closed(self):
        s=run('hbq');self.assertIn('NO_SONY_HOST_ACTION',s)
        self.assertIn('view=home area=tv-card focus=0',s)
    def test_volume_passthrough_fail_closed(self):
        s=run('+q');self.assertIn('UNHANDLED_SONY_SYSTEM_KEY',s)
        self.assertIn('view=tv area=tv-card',s)
    def test_source_and_guide_passthrough(self):self.assertEqual(run('igq').count('UNHANDLED_SONY_SYSTEM_KEY'),2)
    def test_tv_is_explicitly_mocked(self):
        s=run('htq');self.assertIn('MOCK-TV: separate host-owned video',s)
        self.assertIn('view=tv area=tv-card focus=0',s)
    def test_detail_dpad_does_not_move_focus(self):
        s=run('hsowdq');self.assertEqual(s.count('view=detail area=apps focus=0'),3)
    def test_newline_is_noop(self):self.assertEqual(run('h\nq').count('STATE '),2)
    def test_invalid_key_no_action(self):self.assertIn('UNKNOWN_INPUT',run('?q'))
    def test_complete_keyboard_stress(self):
        s=run('h'+('wasd'*2500)+'q')
        self.assertEqual(s.count('STATE '),10002)
        self.assertTrue(s.rstrip().endswith('EXIT'))
    def test_host_has_no_sony_proprietary_symbols(self):
        symbols=subprocess.check_output(['nm','-D',str(HOST)],text=True)
        for token in ('am_client_init','am_send_cmd','DirectFBCreate','libdirectfb'):self.assertNotIn(token,symbols)
    def test_no_device_system_operations(self):
        src='\n'.join((HERE/p).read_text() for p in ['demo_core.c','arm_linux_io.c','host_posix.c'])
        for token in ('/dev/mtd','/dev/mmcblk','/3rd_rw','system(','execve(','ioctl('):self.assertNotIn(token,src)
    def test_optional_arm_qemu_exec(self):
        emulator=shutil.which('qemu-arm')
        if emulator is None:self.skipTest('qemu-arm not installed on this host; ARM execution not claimed')
        res=subprocess.run([emulator,str(ARM)],input='hsq',capture_output=True,text=True,timeout=15,check=True)
        self.assertIn('view=home area=apps',res.stdout)

if __name__=='__main__':unittest.main(verbosity=2)
