import tempfile
import unittest
import zipfile
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from firmware_lab import magic, inspect_file, inspect_zip, scan


class FirmwareLabTests(unittest.TestCase):
    def test_magic(self):
        self.assertIn('ELF', magic(b'\x7fELF' + b'0' * 20))
        self.assertIn('SquashFS little-endian', magic(b'hsqs'))
        self.assertIn('unknown; may be proprietary, signed, compressed or encrypted', magic(b'unknown'))

    def test_zip_checks_and_paths(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / 'update.zip'
            with zipfile.ZipFile(p, 'w') as z:
                z.writestr('update.pkg', b'abc')
                z.writestr('../bad', b'def')
            report = inspect_zip(p)
            self.assertEqual(report['entry_count'], 2)
            self.assertFalse(report['members'][0]['unsafe_path'])
            self.assertTrue(report['members'][1]['unsafe_path'])

    def test_scan_and_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            p = root / 'portal' / 'catalog.xml'
            p.parent.mkdir()
            p.write_text('<app>Berliner Philharmoniker</app>', encoding='utf-8')
            self.assertEqual(len(inspect_file(p)['sha256']), 64)
            self.assertEqual(scan(root)['matches'][0]['path'], 'portal/catalog.xml')


if __name__ == '__main__':
    unittest.main()
