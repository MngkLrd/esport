import hashlib
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'source'))
import patch_original_home as patch
import tv_live_trial as trial

class Patcher(unittest.TestCase):
    def test_anchor_patch_exact_stubs_and_manifest(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d); source=base/'oem';source.mkdir();out=base/'work'
            idx='<script type="text/javascript" src="allappsmodule.js"></script>'
            apps='tmpApp = removeDuplicate(tmpApplication);\n'+'\n'.join(patch.LAUNCH_CALLS)
            (source/'index.html').write_text(idx)
            (source/'allappsmodule.js').write_text(apps)
            pins={'index.html':hashlib.sha256(idx.encode()).hexdigest(),
                  'allappsmodule.js':hashlib.sha256(apps.encode()).hexdigest()}
            pfile=base/'pins.json';pfile.write_text(json.dumps(pins))
            with mock.patch.object(patch,'PINS_FILE',pfile):
                result=patch.build(source,out,ROOT/'source')
            self.assertIn('bravia_catalog.js',(out/'index.html').read_text())
            self.assertIn('BraviaCatalog.mapServices',(out/'allappsmodule.js').read_text())
            self.assertEqual((out/'allappsmodule.js').read_text().count('BraviaCatalog.launch'),3)
            self.assertEqual(result['patched_files'],['index.html','allappsmodule.js'])
            self.assertFalse(result['sony_usb_installable'])
            self.assertEqual((source/'index.html').read_text(),idx)
            self.assertEqual((source/'allappsmodule.js').read_text(),apps)
            with mock.patch.object(patch,'PINS_FILE',pfile):
                with self.assertRaises(ValueError):patch.build(source,out,ROOT/'source')
    def test_wrong_oem_hash_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            origin=Path(d);(origin/'index.html').write_text('some other Sony version')
            with self.assertRaises(ValueError):patch.checked(origin,'index.html')
    def test_actual_owner_original_oem_hashes_match_if_available(self):
        oem=Path('/mnt/data/bravia_stage26_private/OEM_REFERENCE_ONLY/cobalt/content/web/html5ui')
        if not oem.is_dir():self.skipTest('Private OEM reference not included in distributed package')
        for file in ('index.html','allappsmodule.js'):
            self.assertGreater(len(patch.checked(oem,file)),300)
    def test_real_patch_output_if_private_original_available(self):
        oem=Path('/mnt/data/bravia_stage26_private/OEM_REFERENCE_ONLY/cobalt/content/web/html5ui')
        if not oem.is_dir():self.skipTest('Private OEM ref unavailable')
        with tempfile.TemporaryDirectory() as d:
            result=patch.build(oem,Path(d)/'patched',ROOT/'source')
            self.assertEqual(len(result['added_files']),11)
            self.assertTrue((Path(d)/'patched/bravia_assets/kion.png').is_file())

class CDPGuards(unittest.TestCase):
    def test_private_ipv4_only(self):
        for ip in ('192.168.1.4','10.2.0.5','172.17.0.7'):
            self.assertEqual(trial.private_ip(ip),ip)
        for ip in ('example.com','1.1.1.1','127.0.0.1','169.254.1.1','192.0.2.42','224.0.0.1'):
            with self.subTest(ip=ip),self.assertRaises(ValueError):trial.private_ip(ip)
    def test_only_exact_sony_home_debug_target(self):
        t=[{'type':'page','url':'file:///html5ui/index.html',
            'webSocketDebuggerUrl':'ws://127.0.0.1:9224/devtools/page/3'}]
        target=trial.select_home(t,'192.168.1.5')
        self.assertEqual(target['ws'],'ws://192.168.1.5:9224/devtools/page/3')
        t[0]['url']='file:///html5ui/index.html.evil'
        with self.assertRaises(ValueError):trial.select_home(t,'192.168.1.5')
    def test_foreign_cdp_port_or_tab_rejected(self):
        for ws in ('ws://host:1234/devtools/page/3','ws://host:9224/other/page/3'):
            t=[{'type':'page','url':'file:///html5ui/index.html','webSocketDebuggerUrl':ws}]
            with self.assertRaises(ValueError):trial.select_home(t,'192.168.1.10')
    def test_probe_status_and_revert_have_no_writes(self):
        self.assertIn('BRAVIA_RAM_OFF',trial.expression('status',ROOT/'source'))
        self.assertIn('window.__braviaRamUndo',trial.expression('revert',ROOT/'source'))
        code=trial.expression('apply',ROOT/'source')
        self.assertIn('var BraviaCatalog',code)
        self.assertIn('BRAVIA_RAM_CATALOG_ACTIVE',code)
        for unsafe in ('/dev/mmcblk','fw_setenv','firmware/update','dm-verity'):
            self.assertNotIn(unsafe,code)

if __name__=='__main__':unittest.main(verbosity=2)
