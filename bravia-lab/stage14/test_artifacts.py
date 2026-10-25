"""Offline artifact sanity checks; no TV I/O, no OEM binaries."""
from pathlib import Path
import json,subprocess,unittest,re
HERE=Path(__file__).resolve().parent
BIN=HERE.parent/'native_core'/'render_dump'
class ArtifactChecks(unittest.TestCase):
 def scene(self,*args):
  return [json.loads(x) for x in subprocess.check_output([str(BIN),'1280','720',*args],text=True).splitlines()]
 def test_home_ten_tiles(self):
  arr=self.scene('home')
  positions={(c[1],c[2]) for c in arr if c[0]==1 and c[3]==216 and c[4]==130}
  self.assertEqual(len(positions),10)
 def test_tv_no_fake_video(self):self.assertEqual(self.scene('tv'),[])
 def test_home_visual_contains_all_apps(self):
  raw=' '.join(x[9] for x in self.scene('home') if isinstance(x[9],str))
  for name in ['Кинопоиск','Иви','START','Netflix','YouTube','RUTUBE','Media Station X','Al(co)pac','Браузер','КИОН']:
   with self.subTest(name=name):self.assertIn(name,raw)
 def test_no_fake_ready_by_default(self):
  marks=[x[9] for x in self.scene('home') if x[0]==3 and x[9] in ('?','✓','×')]
  self.assertEqual(marks,['?']*10)
 def test_demo_status_does_not_change_source_defaults(self):
  marks=[x[9] for x in self.scene('home','apps','3','demo') if x[0]==3 and x[9] in ('?','✓','×')]
  self.assertEqual(marks.count('✓'),1)
  self.assertEqual(marks.count('×'),1)
  self.assertEqual(marks.count('?'),8)
 def test_detail_status(self):
  raw=' '.join(x[9] for x in self.scene('detail','detail','9','demo') if isinstance(x[9],str))
  self.assertIn('не зарегистрировано',raw)
 def test_html_contains_same_scene_source(self):
  h=(HERE/'BRAVIA_HOME_v14_INTERACTIVE_PREVIEW.html').read_text()
  self.assertIn('ОФЛАЙН-ДЕМО',h)
  self.assertIn('const scenes=',h)
  self.assertIn('home_app3',h)
  self.assertIn('detail9',h)
 def test_core_no_socket_or_firmware_writes(self):
  for file in ['home_core.c','render.c','host_dispatch.c']:
   txt=(HERE.parent/'native_core'/file).read_text()
   for token in ['socket(', 'system(', 'fork(', 'exec(', 'fopen(', 'am_send_cmd(']:
    self.assertNotIn(token,txt,msg=(file,token))
 def test_arm_binary_type(self):
  b=HERE/'build'/'BRAVIA_HOME_v14_ARMv7_ET_REL.o'
  r=subprocess.check_output(['readelf','-h',str(b)],text=True)
  self.assertIn('ELF32',r);self.assertIn('ARM',r);self.assertIn('REL (Relocatable file)',r)
 def test_arm_no_undefined_imports(self):
  b=HERE/'build'/'BRAVIA_HOME_v14_ARMv7_ET_REL.o'
  sym=subprocess.check_output(['readelf','-W','-s',str(b)],text=True)
  unknown=[x for x in sym.splitlines() if ' UND ' in x and 'GLOBAL' in x]
  self.assertEqual(unknown,[])
if __name__=='__main__':unittest.main(verbosity=2)
