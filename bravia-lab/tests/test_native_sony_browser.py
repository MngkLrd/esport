"""Off-device Chromium tests with a mocked Sony HomeuiInterface.
Do NOT interpret results as physical TV or signed firmware validation.
"""
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'ui'
def bundle():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(ROOT/'style.css').read_text(encoding='utf-8')+'</style>')
    for name in ('app-data.js','sony_native_bridge.js','launcher.js'):
        html=html.replace('<script src="'+name+'"></script>','<script>'+(ROOT/name).read_text(encoding='utf-8')+'</script>')
    return html
class MockSony(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p=sync_playwright().start()
        cls.b=cls.p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):cls.b.close();cls.p.stop()
    def make(self,native=True):
        ctx=self.b.new_context(viewport={'width':1280,'height':720})
        page=ctx.new_page();page.set_content(bundle())
        if native: page.evaluate('window.__calls=[];window.HomeuiInterface={GetMenu:function(){return "{}"},LaunchMenu:function(v){window.__calls.push(JSON.parse(v))}};')
        return ctx,page
    def dock(self,page,offset):
        for key in ['h','ArrowDown','ArrowDown','ArrowDown']+['ArrowRight']*offset:page.keyboard.press(key)
    def test_native_settings(self):
        ctx,p=self.make();self.dock(p,3);p.keyboard.press('Enter')
        self.assertEqual(p.evaluate('window.__calls'),[{'text':'System Settings'}])
        self.assertEqual(p.locator('body').get_attribute('data-screen'),'home');ctx.close()
    def test_native_channels(self):
        ctx,p=self.make();self.dock(p,1);p.keyboard.press('Enter')
        self.assertEqual(p.evaluate('window.__calls'),[{'text':'Programme List'}]);ctx.close()
    def test_native_inputs_unavailable(self):
        ctx,p=self.make();self.dock(p,2);p.keyboard.press('Enter')
        self.assertEqual(p.evaluate('window.__calls'),[])
        self.assertEqual(p.locator('body').get_attribute('data-screen'),'detail');ctx.close()
    def test_no_sony_context(self):
        ctx,p=self.make(False);self.dock(p,3);p.keyboard.press('Enter')
        self.assertEqual(p.locator('body').get_attribute('data-screen'),'detail');ctx.close()
    def test_starts_tv(self):
        ctx,p=self.make();self.assertEqual(p.locator('body').get_attribute('data-screen'),'tv');ctx.close()
    def test_ten_tiles(self):
        ctx,p=self.make();p.keyboard.press('h');self.assertEqual(p.locator('.app-tile').count(),10);ctx.close()
if __name__=='__main__':unittest.main()
