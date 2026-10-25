import json
import os
import sys
import tempfile
import unittest
import zipfile
from unittest import mock
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from firmware_triage import assess_package,sample_entropy,EXPECTED_SIZE_8931,SONY_8931
from rootfs_inventory import inspect_rootfs,safe_text,unit_details,init_details,domain_host,catalog_candidate
from audit_bloat import assess

class TVPackageCases(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.base=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()
    def z(self,name='sony.zip',members=None):
        p=self.base/name
        with zipfile.ZipFile(p,'w') as a:
            for key,val in (members or {'pkg/update.pkg':b'PKGfake\x00'}).items():a.writestr(key,val)
        return p
    def test_01_zero_entropy(self):self.assertEqual(sample_entropy(b''),0.)
    def test_02_homogeneous_entropy(self):self.assertEqual(sample_entropy(b'aaaa'),0.)
    def test_03_binary_entropy(self):self.assertEqual(sample_entropy(bytes(range(256))),8.)
    def test_04_official_size_constant(self):self.assertEqual(EXPECTED_SIZE_8931,289426738)
    def test_05_zip_report(self):self.assertEqual(assess_package(self.z())['zip']['entry_count'],1)
    def test_06_header(self):self.assertEqual(assess_package(self.z())['members'][0]['header_hex_16'],b'PKGfake\x00'.hex())
    def test_07_all_flash_blocked(self):self.assertIs(assess_package(self.z())['safe_to_flash'],False)
    def test_08_signatures_not_assumed(self):self.assertIs(assess_package(self.z())['signature_verified'],False)
    def test_09_nonzip_safe(self):
        p=self.base/'other.pkg';p.write_bytes(b'raw')
        self.assertIsNone(assess_package(p)['zip'])
    def test_10_prevent_zip_slip(self):self.assertFalse(any(x['name']=='../oops' for x in assess_package(self.z(members={'../oops':b'x'}))['members']))
    def test_11_detect_absolute(self):self.assertTrue(any('Unsafe member path' in x for x in assess_package(self.z(members={'/danger':b'x'}))['warnings']))
    def test_12_detect_drive_path(self):self.assertTrue(any('Unsafe member path' in x for x in assess_package(self.z(members={'C:/x':b'x'}))['warnings']))
    def test_13_detect_windows_traversal(self):self.assertTrue(any('Unsafe member path' in x for x in assess_package(self.z(members={r'dir\..\secret':b'x'}))['warnings']))
    def test_14_unknown_payload(self):self.assertIn('unknown',assess_package(self.z(members={'payload':b'nonsense'}))['members'][0]['magic'][0])
    def test_15_elf_payload(self):self.assertIn('ELF',assess_package(self.z(members={'p':b'\x7fELF'+b'\0'*30}))['members'][0]['magic'])
    def test_16_squashfs_payload(self):self.assertTrue('SquashFS' in assess_package(self.z(members={'p':b'hsqs'+b'\0'*30}))['members'][0]['magic'][0])
    def test_17_preserve_raw(self):
        p=self.z();before=p.read_bytes();assess_package(p);self.assertEqual(before,p.read_bytes())
    def test_18_official_name_wrong_size(self):self.assertTrue(any('file size differs' in x for x in assess_package(self.z(name=SONY_8931))['warnings']))
    def test_19_no_extract(self):
        self.z(members={'firmware/sub.pkg':b'aaa'});self.assertFalse((self.base/'firmware').exists())
    def test_20_zip_bomb_guard(self):
        p=self.z(members={'too-big':b'fake'});
        with mock.patch('firmware_triage.MAX_TOTAL_UNCOMPRESSED',2):
            result=assess_package(p)
        self.assertEqual(result['members'],[])
    def test_21_symlink_guard(self):
        p=self.base/'links.zip'
        info=zipfile.ZipInfo('symlink');info.create_system=3;info.external_attr=(0o120777<<16)
        with zipfile.ZipFile(p,'w') as z:z.writestr(info,'/etc/passwd')
        self.assertFalse(assess_package(p)['members'])

class RootfsCases(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()
    def write(self,path,content):
        p=self.root/path;p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text(content,encoding='utf-8');return p
    def row(self):return inspect_rootfs(self.root)
    def test_22_empty(self):self.assertEqual(self.row()['components'],[])
    def test_23_unit_file(self):
        self.write('etc/systemd/system/stream.service','[Service]\nExecStart=/usr/bin/streamd\n')
        self.assertEqual(self.row()['components'][0]['name'],'etc/systemd/system/stream.service')
    def test_24_unit_exec(self):self.assertEqual(unit_details('[Service]\nExecStart=/bin/foo --silent')['exec'],['/bin/foo --silent'])
    def test_25_unit_dep(self):self.assertEqual(unit_details('[Unit]\nAfter=network.service sound.service')['dependencies'],['network.service','sound.service'])
    def test_26_map_known_dependencies(self):
        self.write('etc/systemd/system/a.service','[Unit]\nRequires=b.service\n[Service]\nExecStart=/usr/bin/a\n')
        self.write('etc/systemd/system/b.service','[Service]\nExecStart=/usr/bin/b\n')
        x={p['name']:p for p in self.row()['components']}
        self.assertIn('etc/systemd/system/b.service',x['etc/systemd/system/a.service']['depends_on'])
    def test_27_unresolved_dep_kept_explicit(self):
        self.write('etc/systemd/system/a.service','[Unit]\nWants=missing.service\n')
        self.assertIn('missing.service',self.row()['components'][0]['unit_dependencies'])
    def test_28_init_script(self):
        self.write('etc/init.d/bootme','#!/bin/sh\nstart-stop-daemon --start --exec /usr/bin/tuner\n')
        self.assertEqual(len(self.row()['components']),1)
    def test_29_init_exec(self):self.assertIn('exec /bin/a',init_details('exec /bin/a')['exec'])
    def test_30_inittab(self):
        self.write('etc/inittab','::sysinit:/etc/init.d/rcS')
        self.assertEqual(self.row()['startup_entries'][0]['path'],'etc/inittab')
    def test_31_rc_symlink(self):
        p=self.root/'etc/rc3.d/S10service';p.parent.mkdir(parents=True,exist_ok=True);p.symlink_to('../init.d/service')
        self.assertEqual(self.row()['startup_entries'][0]['symlink_target'],'../init.d/service')
    def test_32_file_symlink_ignored(self):
        target=self.write('outside.txt','VEWD');p=self.root/'etc/init.d/nolook';p.parent.mkdir(parents=True,exist_ok=True);p.symlink_to(target)
        self.assertEqual(self.row()['components'],[])
    def test_33_catalog_candidate(self):
        self.write('www/apps/catalog.json','{"apps":[{"name":"Berliner Philharmoniker"}]}')
        self.assertEqual(len(self.row()['webapp_catalog_candidates']),1)
    def test_34_not_all_files_catalogs(self):
        self.write('etc/settings.conf','timezone=UTC')
        self.assertEqual(len(self.row()['webapp_catalog_candidates']),0)
    def test_35_domain_extract(self):
        self.write('etc/web/app.json','{"url":"https://telemetry.example.test/path"}')
        r=self.row();self.assertEqual(r['domains'][0]['host'],'telemetry.example.test')
    def test_36_domain_not_claimed_tracker(self):
        self.write('etc/web/app.json','{"url":"https://analytics.example.org/path"}')
        self.assertIn('NOT PROOF',self.row()['domains'][0]['classification'])
    def test_37_host_normalized(self):self.assertEqual(domain_host('https://EXAMPLE.Com/x'),'example.com')
    def test_38_bogus_url_ignored(self):self.assertIsNone(domain_host('https://%%%/x'))
    def test_39_size_guard(self):
        p=self.write('etc/init.d/huge','a'*(1024*1024+1));self.assertIsNone(safe_text(p))
    def test_40_binary_guard(self):
        p=self.write('etc/init.d/binary','\x00a');self.assertIsNone(safe_text(p))
    def test_41_no_commands_run(self):
        self.write('etc/init.d/harm','exec touch /tmp/tv-rootfs-test-should-not-exist')
        self.row();self.assertFalse(Path('/tmp/tv-rootfs-test-should-not-exist').exists())
    def test_42_unknown_service_safe(self):
        self.write('etc/init.d/anon','exec /bin/x')
        row=self.row()['components'][0]
        self.assertEqual(assess([row])['items'][0]['status'],'KEEP')
    def test_43_not_cpu_claim(self):
        self.write('etc/init.d/foo','exec /bin/x')
        self.assertIsNone(self.row()['components'][0]['rss_kib_observed'])
    def test_44_no_rootfs_writes(self):
        p=self.write('etc/init.d/foo','exec /bin/x');orig=p.read_bytes();self.row();self.assertEqual(orig,p.read_bytes())
    def test_45_limited_catalogs(self):
        for i in range(5):self.write(f'etc/web/app{i}.json','{"name":"Netflix"}')
        self.assertEqual(len(inspect_rootfs(self.root,max_hits=2)['webapp_catalog_candidates']),2)
    def test_46_limit_files(self):
        for i in range(4):self.write(f'etc/init.d/{i}','exec /bin/x')
        r=inspect_rootfs(self.root,max_files=2)
        self.assertTrue(r['files_limit_reached'])
    def test_47_missing_dir(self):
        with self.assertRaises(ValueError):inspect_rootfs(self.root/'missing')
    def test_48_optional_traversal(self):
        (self.root/'etc').mkdir();(self.root/'etc/evil').symlink_to('/etc',target_is_directory=True)
        self.assertEqual(self.row()['components'],[])
    def test_49_duplicate_different_paths(self):
        self.write('etc/init.d/test','exec /bin/a');self.write('etc/systemd/system/test.service','[Service]\nExecStart=/bin/a')
        self.assertEqual(len(self.row()['components']),2)
    def test_50_unknown_deps_keep_not_delete(self):
        self.write('etc/systemd/system/app.service','[Unit]\nAfter=net-dhcp.service\n[Service]\nExecStart=/bin/a')
        r=self.row();self.assertFalse(any(item.get('safe_to_remove') for item in r['components']))

if __name__=='__main__':unittest.main()
