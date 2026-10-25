"""Mock-only browser integration; never a claim of Sony hardware compatibility."""
import unittest
from pathlib import Path
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright=None
UI=Path(__file__).resolve().parents[1]/'ui'/'index.html'
UI_DIR=UI.parent
NATIVE="""window.__calls=[];window.HomeuiInterface={
 bivlservicelist:JSON.stringify({data:[{service_name:'Netflix',service_id:23234,service_type:'Video',service_index:2,icon_url:'netflix.png'}]}),
 LaunchApp:function(v){window.__calls.push(JSON.parse(v));},
 GetMenu:function(){return '{}'},LaunchMenu:function(v){window.__calls.push({menu:JSON.parse(v)});}
};"""
@unittest.skipUnless(sync_playwright,'Playwright required')
class CatalogBrowser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.play=sync_playwright().start()
        cls.browser=cls.play.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True)
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.play.stop()
    def page(self,native=True):
        context=self.browser.new_context(viewport={'width':1280,'height':720})
        html=UI.read_text(encoding='utf-8')
        html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (UI_DIR/'style.css').read_text(encoding='utf-8')+'</style>')
        for name in ('app-data.js','sony_native_bridge.js','sony_catalog_bridge.js','launcher.js'):
            html=html.replace('<script src="'+name+'"></script>', '<script>'+ (UI_DIR/name).read_text(encoding='utf-8')+'</script>')
        if native:html=html.replace('<script>/* Offline visual catalog;', '<script>'+NATIVE+'</script><script>/* Offline visual catalog;')
        page=context.new_page();page.set_content(html);return context,page
    def key(self,page,*keys):
        for k in keys:page.keyboard.press(k)
    def test_default_tv_boot(self):
        c,p=self.page();self.assertEqual(p.locator('body').get_attribute('data-screen'),'tv');c.close()
    def test_ten_ui_tiles(self):
        c,p=self.page();self.key(p,'h');self.assertEqual(p.locator('.app-tile').count(),10);c.close()
    def test_registered_netflix_launch(self):
        c,p=self.page();self.key(p,'h','ArrowDown','ArrowRight','ArrowRight','ArrowRight','Enter')
        self.assertEqual(p.evaluate('window.__calls.length'),1)
        self.assertEqual(p.evaluate('window.__calls[0].service_id'),23234)
        self.assertEqual(p.evaluate('window.__calls[0].uri'),'')
        self.assertEqual(p.locator('body').get_attribute('data-screen'),'home');c.close()
    def test_unregistered_kinopoisk_stays_prototype(self):
        c,p=self.page();self.key(p,'h','ArrowDown','Enter')
        self.assertEqual(p.evaluate('window.__calls.length'),0)
        self.assertEqual(p.locator('body').get_attribute('data-screen'),'detail');c.close()
    def test_unregistered_kion_stays_prototype(self):
        c,p=self.page();self.key(p,'h','ArrowDown','ArrowRight','ArrowRight','ArrowRight','ArrowRight','ArrowDown','Enter')
        self.assertEqual(p.evaluate('window.__calls.length'),0)
        self.assertEqual(p.locator('body').get_attribute('data-screen'),'detail');c.close()
    def test_without_native_context_no_launch(self):
        c,p=self.page(False);self.key(p,'h','ArrowDown','ArrowRight','ArrowRight','ArrowRight','Enter')
        self.assertEqual(p.locator('body').get_attribute('data-screen'),'detail');c.close()
    def test_settings_still_native(self):
        c,p=self.page();self.key(p,'h','ArrowDown','ArrowDown','ArrowDown','ArrowRight','ArrowRight','ArrowRight','Enter')
        self.assertEqual(p.evaluate('window.__calls[0].menu.text'),'System Settings');c.close()
if __name__=='__main__':unittest.main()
