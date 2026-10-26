#!/usr/bin/env python3
"""Off-device test of generated native UI_LOGO assets and retained C renderer."""
import json, subprocess, unittest
from pathlib import Path
from PIL import Image
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
class BackplateTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  subprocess.run(["python3",str(HERE/"generate_assets.py")],check=True,timeout=30)
  subprocess.run(["make","-C",str(ROOT/"native_core"),"render_dump"],check=True,timeout=30)
  cls.assets=json.loads((HERE/"assets"/"manifest.json").read_text())["assets"]
 def test_number_of_assets(self):self.assertEqual(len(self.assets),30)
 def test_unique_id_and_variants(self):
  self.assertEqual({(a["id"],a["variant"]) for a in self.assets},{(i,s) for i in range(10) for s in range(3)})
 def test_dimensions_and_alpha(self):
  for a in self.assets:
   with self.subTest(a=a["file"]),Image.open(HERE/a["file"]) as image:
    self.assertEqual(image.size,(144,75));self.assertEqual(image.mode,"RGBA")
    self.assertGreater(image.getchannel("A").getextrema()[1],0)
 def test_status_opacity(self):
  for i in range(10):
   values={}
   for a in self.assets:
    if a["id"]==i:
     with Image.open(HERE/a["file"]) as image:values[a["variant"]]=image.getchannel("A").getextrema()[1]
   self.assertGreater(values[1],values[0]);self.assertGreater(values[0],values[2])
 def test_native_renderer_ten_logo_commands(self):
  raw=subprocess.check_output([str(ROOT/"native_core/render_dump"),"1280","720","home","apps","3","demo"],text=True)
  cmds=[json.loads(row) for row in raw.splitlines()]
  logos=[row for row in cmds if row[0]==4]
  self.assertEqual([x[11] for x in logos],list(range(10)))
  self.assertEqual([x[12] for x in logos],[0,0,0,1,0,0,0,0,0,2])
 def test_native_text_labels_preserved(self):
  raw=subprocess.check_output([str(ROOT/"native_core/render_dump"),"1280","720","home","tv","0","demo"],text=True)
  labels=[json.loads(x)[9] for x in raw.splitlines()]
  for required in ("Кинопоиск","Иви","START","Netflix","YouTube","RUTUBE","Media Station X","Al(co)pac","Браузер","КИОН"):
   self.assertIn(required,labels)
if __name__=="__main__":unittest.main(verbosity=2)
