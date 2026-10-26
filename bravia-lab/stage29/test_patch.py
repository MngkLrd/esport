import hashlib,json,sys,tempfile,unittest,shutil
from pathlib import Path
HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE/'stage29'))
from patch_verified_oem import build,original_file,transform, browser_config_check, APP_NAMES, PIN
class Stage29Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.source=Path('/mnt/data/bravia_stage29_private')
  cls.have=(cls.source/'3rd2/cobalt/content/web/html5ui/index.html').exists()
 def test_exact_original_shas_when_present(self):
  if not self.have:self.skipTest('Private original Sony files not provided')
  base=self.source/'3rd2/cobalt/content/web/html5ui'
  for x in PIN:self.assertIsInstance(original_file(base,x),str)
 def test_original_sony_web_app_registration(self):
  if not self.have:self.skipTest('OEM files missing')
  state=browser_config_check(self.source)
  self.assertTrue(state['browser_base_registers_web_app'])
  self.assertTrue(state['web_app_mouse_disabled'])
  self.assertFalse(state['browser_profile_modified'])
 def test_sony_two_resource_copies_match(self):
  if not self.have:self.skipTest('Private Sony copies missing')
  for fname in PIN:
   a=(self.source/'3rd2/cobalt/content/web/html5ui'/fname).read_bytes()
   b=(self.source/'3rd2/cobalt/apps/html5ui/ui'/fname).read_bytes()
   self.assertEqual(a,b)
 def test_patch_real_oem_offline_in_separate_destination(self):
  if not self.have:self.skipTest('Original files absent')
  with tempfile.TemporaryDirectory() as d:
   out=Path(d)/'test-patch'
   result=build(self.source,out,HERE)
   self.assertEqual(len(result['ten_requested_apps']),10)
   self.assertEqual(len(result['modified_vendor_file_hashes']),4)
   self.assertEqual(result['root_menu_reroute']['modified_home_routes'],3)
   self.assertTrue((out/'root/basic/keymap_tv.ini').is_file())
   self.assertEqual((out/'root/basic/keymap_tv.ini').read_text().count('ROOT_MENU=html5ui(stop)[start]'),3)
   self.assertFalse(result['installable_sony_usb_update'])
   self.assertFalse(result['sony_signed_and_verity_valid'])
   self.assertFalse(result['oem_region_catalog_source_fully_identified'])
   for name in ('channelsmodule.js','settingsmodule.js','recordmodule.js','mediamodule.js'):
    self.assertFalse(list(out.rglob(name)))
   for x in result['patched_own_home_copies']:
    html=(out/x/'index.html').read_text()
    app=(out/x/'allappsmodule.js').read_text()
    self.assertIn('bravia_catalog.js',html)
    self.assertIn('tmpApp = BraviaCatalog.mapServices({data:[]});',app)
    self.assertEqual(app.count('BraviaCatalog.launch('),3)
    self.assertEqual((out/x/'bravia_assets').glob('*.png').__iter__().__next__().suffix,'.png')
    self.assertTrue((out/x/'bravia_clients/rutube/index.html').is_file())
 def test_rejected_unknown_vendor_keymap(self):
  if not self.have:self.skipTest('Original owner image missing')
  with tempfile.TemporaryDirectory() as d:
   src=Path(d)/'root/basic';src.mkdir(parents=True)
   shutil.copyfile(self.source/'root/basic/am_start.ini',src/'am_start.ini')
   (src/'keymap_tv.ini').write_text('ROOT_MENU=dockui(stop)[start]\n')
   from patch_verified_oem import reroute_home
   with self.assertRaises(ValueError):reroute_home(Path(d),Path(d)/'out')
 def test_unknown_oem_hash_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   dest=Path(d);(dest/'index.html').write_bytes(b'<html>changed</html>')
   with self.assertRaises(ValueError):original_file(dest,'index.html')
 def test_original_cannot_be_overwritten(self):
  with tempfile.TemporaryDirectory() as d:
   original=Path(d);(original/'existing').mkdir()
   with self.assertRaises(ValueError):build(self.source,original/'existing',HERE)
 def test_anchor_refuses_unsupported_vendor_changes(self):
  with self.assertRaises(ValueError):transform('other index','other apps')
 def test_explicit_no_drm_or_runtime_claim(self):
  if not self.have:self.skipTest('Original files absent')
  with tempfile.TemporaryDirectory() as d:
   rpt=build(self.source,Path(d)/'overlay',HERE)
   self.assertFalse(rpt['embedded_rutube_playback_on_tv_proven'])
   self.assertFalse(rpt['launch_via_native_sony_web_app_profile_proven'])
   self.assertEqual(rpt['home_launcher_in_use_on_physical_tv'],'UNKNOWN')
if __name__=='__main__':unittest.main(verbosity=2)
