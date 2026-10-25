"""Offline only; positive and reverse tests for the firmware analyzer."""
import tempfile
import unittest
import zipfile
import io
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from firmware_lab import magic, inspect_file, inspect_zip, scan, sha256_file, main


class ExtendedFirmwareTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)

    def touch(self,name,data):
        p=self.root/name
        p.parent.mkdir(parents=True,exist_ok=True)
        p.write_bytes(data)
        return p

    def test_positive_zip_signature(self): self.assertEqual(magic(b'PK\x03\x04'),'ZIP' if False else ['ZIP'])
    def test_positive_gzip_signature(self): self.assertIn('gzip',magic(b'\x1f\x8b'))
    def test_positive_xz_signature(self): self.assertIn('XZ',magic(b'\xfd7zXZ\x00'))
    def test_positive_uimage_signature(self): self.assertIn('uImage',magic(b'\x27\x05\x19\x56'))
    def test_positive_fit_signature(self): self.assertIn('FDT/FIT',magic(b'\xd0\x0d\xfe\xed'))
    def test_positive_jffs2_signature(self): self.assertIn('JFFS2 candidate',magic(b'\x85\x19'))
    def test_positive_ext_signature(self):
        blob=bytearray(2048);blob[1080:1082]=b'\x53\xef'
        self.assertIn('ext2/3/4 candidate (superblock magic)',magic(blob))
    def test_positive_file_size(self): self.assertEqual(inspect_file(self.touch('f.bin',b'hello'))['size'],5)
    def test_positive_sha_stable(self):
        p=self.touch('f.bin',b'abc');self.assertEqual(sha256_file(p),sha256_file(p))
    def test_positive_empty_sha(self): self.assertEqual(len(inspect_file(self.touch('f.bin',b''))['sha256']),64)
    def test_positive_zip_unicode(self):
        p=self.root/'p.zip'
        with zipfile.ZipFile(p,'w') as z: z.writestr('тест/каталог.xml','тест')
        self.assertEqual(inspect_zip(p)['members'][0]['name'],'тест/каталог.xml')
    def test_positive_zip_member_count(self):
        p=self.root/'p.zip'
        with zipfile.ZipFile(p,'w') as z:
            for n in range(3):z.writestr('safe-%d.txt'%n,'z')
        self.assertEqual(inspect_zip(p)['entry_count'],3)
    def test_positive_scan_manifest(self):
        self.touch('etc/app.xml',b'<manifest>vewd</manifest>')
        self.assertTrue(scan(self.root)['matches'])
    def test_positive_scan_json(self):
        self.touch('etc/catalog.json',b'{"widget":true}')
        self.assertEqual(scan(self.root)['matches'][0]['line'],1)
    def test_positive_scan_limit(self):
        self.touch('x.txt',b'widget\nwidget\nwidget\n')
        r=scan(self.root,max_hits=2)
        self.assertEqual(len(r['matches']),2);self.assertTrue(r['truncated'])
    def test_positive_scan_filecount(self):
        self.touch('x.txt',b'foo');self.touch('x.bin',b'foo')
        self.assertEqual(scan(self.root)['scanned_files'],1)
    def test_positive_scan_hidden_file(self):
        self.touch('a/.hidden.xml',b'<widget/>')
        self.assertEqual(len(scan(self.root)['matches']),1)
    def test_reverse_unknown_magic(self): self.assertIn('unknown',magic(b'\x01\x02')[0])
    def test_reverse_invalid_zip(self):
        with self.assertRaises(zipfile.BadZipFile):inspect_zip(self.touch('bad.zip',b'trash'))
    def test_reverse_unsafe_zip_parent(self):
        p=self.root/'bad.zip'
        with zipfile.ZipFile(p,'w') as z:z.writestr('../bad','a')
        self.assertTrue(inspect_zip(p)['members'][0]['unsafe_path'])
    def test_reverse_unsafe_zip_absolute(self):
        p=self.root/'bad.zip'
        with zipfile.ZipFile(p,'w') as z:z.writestr('/tmp/bad','a')
        self.assertTrue(inspect_zip(p)['members'][0]['unsafe_path'])
    def test_reverse_unsafe_zip_windows(self):
        p=self.root/'bad.zip'
        with zipfile.ZipFile(p,'w') as z:z.writestr('C:/bad','a')
        self.assertTrue(inspect_zip(p)['members'][0]['unsafe_path'])
    def test_reverse_unsafe_zip_backslash(self):
        p=self.root/'bad.zip'
        with zipfile.ZipFile(p,'w') as z:z.writestr('x\\..\\bad','a')
        self.assertTrue(inspect_zip(p)['members'][0]['unsafe_path'])
    def test_reverse_zip_truncation_limit(self):
        p=self.root/'p.zip'
        with zipfile.ZipFile(p,'w') as z:
            for n in range(3):z.writestr('safe-%d.txt'%n,'z')
        r=inspect_zip(p,max_entries=2)
        self.assertEqual(len(r['members']),2);self.assertTrue(r['warnings'])
    def test_reverse_skip_image_scan(self):
        self.touch('pic.png',b'widget');self.assertEqual(scan(self.root)['matches'],[])
    def test_reverse_skip_too_large(self):
        self.touch('large.xml',b'widget'*100)
        self.assertEqual(scan(self.root,max_file_bytes=10)['scanned_files'],0)
    def test_reverse_no_follow_symlink_file(self):
        self.touch('actual.xml',b'<widget/>')
        (self.root/'shortcut.xml').symlink_to(self.root/'actual.xml')
        self.assertEqual(scan(self.root)['skipped_symlinks'],1)
    def test_reverse_no_follow_symlink_directory(self):
        p=self.touch('real/f.xml',b'<widget/>')
        (self.root/'loop').symlink_to(self.root/'real',target_is_directory=True)
        self.assertEqual(len(scan(self.root)['matches']),1)
    def test_reverse_nonexistent_file(self):
        with self.assertRaises(FileNotFoundError):inspect_file(self.root/'missing')
    def test_reverse_text_no_keyword(self):
        self.touch('text.txt',b'unrelated hello world')
        self.assertEqual(scan(self.root)['matches'],[])

if __name__=='__main__':unittest.main()