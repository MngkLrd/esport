from pathlib import Path
import json, subprocess, unittest
from PIL import Image
ROOT=Path(__file__).resolve().parent
CORE=ROOT.parent/'native_core'
BIN=CORE/'render_dump'
class LogoTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  subprocess.run(['make','-C',str(CORE),'render_dump'],check=True)
  subprocess.run(['python3',str(ROOT/'build_assets.py')],check=True)
 def scene(self,*args):
  return [json.loads(line) for line in subprocess.check_output([str(BIN),'1280','720',*args],text=True).splitlines()]
 def test_ten_real_draw_commands(self):
  cmds=[c for c in self.scene('home') if c[0]==4]
  self.assertEqual(len(cmds),10)
  self.assertEqual([c[11] for c in cmds],list(range(10)))
  self.assertEqual([c[12] for c in cmds],[0]*10)
 def test_demo_variants(self):
  cmds=[c for c in self.scene('home','apps','3','demo') if c[0]==4]
  self.assertEqual(cmds[3][12],1)
  self.assertEqual(cmds[9][12],2)
 def test_status_asset_count_and_alpha(self):
  files=list((ROOT/'assets').glob('*.png'))
  self.assertEqual(len(files),30)
  for idx in range(10):
   paths={v:next((ROOT/'assets').glob(f'{idx:02d}_*_{v}.png')) for v in ('unknown','ready','unavailable')}
   alpha={}
   for status,path in paths.items():
    with Image.open(path) as im:
     self.assertEqual(im.size,(144,75));self.assertEqual(im.mode,'RGBA')
     alpha[status]=sum(im.getchannel('A').getdata())
   self.assertGreater(alpha['ready'],alpha['unknown'])
   self.assertGreater(alpha['unknown'],alpha['unavailable'])
 def test_render_command_budget(self):self.assertEqual(len(self.scene('home')),94)
 def test_missing_texture_keeps_fallback_wordmark(self):
  for c in self.scene('home'):
   if c[0]==4:self.assertTrue(c[9] and c[10]==1)
 def test_local_asset_pipeline_has_no_network_fetch(self):
  src=(ROOT/'build_assets.py').read_text()
  for bad in ('requests.get(', 'urlopen(', 'urllib.request(', 'socket('):self.assertNotIn(bad,src)
 def test_logo_geometry_every_resolution(self):
  for w,h in [(320,180),(640,360),(1024,768),(1280,720),(1920,1080),(4096,2160)]:
   data=[json.loads(s) for s in subprocess.check_output([str(BIN),str(w),str(h),'home'],text=True).splitlines()]
   self.assertEqual(len([c for c in data if c[0]==4]),10)
   for c in data:
    self.assertGreater(c[3],0);self.assertGreater(c[4],0)
    self.assertGreaterEqual(c[1],0);self.assertGreaterEqual(c[2],0)
    self.assertLessEqual(c[1]+c[3],w);self.assertLessEqual(c[2]+c[4],h)
 def test_default_ready_unavailable_not_asserted(self):
  labels=[c for c in self.scene('home') if c[0]==3 and c[9] in ('?','✓','×')]
  self.assertEqual(len(labels),10)
  self.assertEqual([c[9] for c in labels],['?']*10)
if __name__=='__main__':unittest.main(verbosity=2)
