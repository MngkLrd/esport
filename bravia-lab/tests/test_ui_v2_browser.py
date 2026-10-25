import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'ui'

def bundle():
    s=(ROOT/'index.html').read_text('utf-8')
    s=s.replace('<link rel="stylesheet" href="style.css">','<style>'+(ROOT/'style.css').read_text('utf-8')+'</style>')
    for f in ['app-data.js','launcher.js']:
        s=s.replace('<script src="'+f+'"></script>','<script>'+(ROOT/f).read_text('utf-8')+'</script>')
    return s

class BraviaV2Browser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pl=sync_playwright().start()
        cls.browser=cls.pl.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        cls.page=cls.browser.new_page(viewport={'width':1280,'height':720})
        cls.html=bundle()
    @classmethod
    def tearDownClass(cls):
        cls.page.close();cls.browser.close();cls.pl.stop()
    def setUp(self):
        self.page.set_viewport_size({'width':1280,'height':720})
        self.page.set_content(self.html)
    def k(self,*keys):
        for key in keys:self.page.keyboard.press(key)
    def home(self):self.k('h')
    def focus(self):return self.page.locator('body').get_attribute('data-focus')
    def screen(self):return self.page.locator('body').get_attribute('data-screen')
    def test_p01_tv_boot(self):self.assertEqual(self.screen(),'tv')
    def test_p02_home_key(self):self.home();self.assertEqual(self.screen(),'home')
    def test_p03_ten_apps(self):self.home();self.assertEqual(self.page.locator('.app-tile').count(),10)
    def test_p04_four_dock(self):self.home();self.assertEqual(self.page.locator('.quick-action').count(),4)
    def test_p05_tv_hero_initial_focus(self):self.home();self.assertEqual(self.focus(),'tvcard:0')
    def test_p06_down_app(self):self.home();self.k('ArrowDown');self.assertEqual(self.focus(),'app:0')
    def test_p07_down_second_row(self):self.home();self.k('ArrowDown','ArrowDown');self.assertEqual(self.focus(),'app:5')
    def test_p08_down_to_dock(self):self.home();self.k('ArrowDown','ArrowDown','ArrowDown');self.assertEqual(self.focus(),'action:0')
    def test_p09_browser_ninth(self):self.home();self.assertEqual(self.page.locator('.app-tile').nth(8).get_attribute('data-id'),'browser')
    def test_p10_msx_name(self):self.home();self.assertTrue(self.page.get_by_text('Media Station X').is_visible())
    def test_p11_alcopac_name(self):self.home();self.assertTrue(self.page.get_by_text('Al(co)pac').first.is_visible())
    def test_p12_tv_hero_clicked(self):self.home();self.page.locator('#tv-card').click(force=True);self.assertEqual(self.screen(),'tv')
    def test_p13_app_click_detail(self):self.home();self.page.locator('.app-tile[data-id="mediax"]').click(force=True);self.assertEqual(self.page.locator('#detail-title').inner_text(),'Media Station X')
    def test_p14_back_from_detail(self):self.home();self.k('ArrowDown','Enter','Escape');self.assertEqual(self.screen(),'home')
    def test_p15_back_to_tv(self):self.home();self.k('Escape');self.assertEqual(self.screen(),'tv')
    def test_p16_click_back(self):self.home();self.k('ArrowDown','Enter');self.page.locator('#detail-back').click(force=True);self.assertEqual(self.screen(),'home')
    def test_p17_selected_focus_unique(self):self.home();self.assertEqual(self.page.locator('.is-focused').count(),1)
    def test_p18_dom_focus_synced(self):self.home();self.k('ArrowDown','ArrowRight');self.assertEqual(self.page.evaluate('document.activeElement.getAttribute("data-id")'),'ivi')
    def test_p19_inactive_not_tabbable(self):self.home();self.assertEqual(self.page.locator('.app-tile[tabindex="0"]').count(),0)
    def test_p20_selected_app_tabbable(self):self.home();self.k('ArrowDown');self.assertEqual(self.page.locator('.app-tile[tabindex="0"]').count(),1)
    def test_p21_detail_explains_not_installed(self):self.home();self.k('ArrowDown','Enter');self.assertIn('не интегрировано',self.page.locator('#detail-message').inner_text())
    def test_p22_back_keeps_app_focus(self):self.home();self.k('ArrowDown','ArrowRight','Enter','Escape');self.assertEqual(self.focus(),'app:1')
    def test_r23_repeated_home_no_dup(self):self.home();self.k('h','h','h');self.assertEqual(self.page.locator('.app-tile').count(),10)
    def test_r24_left_first_app(self):self.home();self.k('ArrowDown','ArrowLeft');self.assertEqual(self.focus(),'app:0')
    def test_r25_right_row1_boundary(self):self.home();self.k('ArrowDown','ArrowRight','ArrowRight','ArrowRight','ArrowRight','ArrowRight');self.assertEqual(self.focus(),'app:4')
    def test_r26_no_system_key_capture(self):
        self.home()
        for key in ['AudioVolumeUp','ChannelUp','Guide','Source']:
            prevented=self.page.evaluate('''key=>{var e=new KeyboardEvent('keydown',{key:key,bubbles:true,cancelable:true});document.dispatchEvent(e);return e.defaultPrevented;}''',key)
            self.assertFalse(prevented,key)
    def test_r27_tv_arrows_not_prevented(self):
        def prevented(key):return self.page.evaluate('''key=>{var e=new KeyboardEvent('keydown',{key:key,bubbles:true,cancelable:true});document.dispatchEvent(e);return e.defaultPrevented;}''',key)
        self.assertFalse(prevented('ArrowUp'))
    def test_r28_body_no_scroll(self):self.home();self.assertEqual(self.page.locator('body').evaluate('(e)=>getComputedStyle(e).overflow'),'hidden')
    def test_r29_no_external_requests(self):
        requests=[];cb=lambda req:requests.append(req.url)
        self.page.on('request',cb)
        try:self.home();self.k('ArrowDown','Enter');self.assertEqual(requests,[])
        finally:self.page.remove_listener('request',cb)
    def test_r30_pointer_hidden(self):self.assertEqual(self.page.locator('body').evaluate('(e)=>getComputedStyle(e).cursor'),'none')
    def test_r31_720p(self):self.geometry(1280,720)
    def test_r32_1080p(self):self.geometry(1920,1080)
    def test_r33_4k(self):self.geometry(3840,2160)
    def test_r34_1366(self):self.geometry(1366,768)
    def test_r35_1024(self):self.geometry(1024,768)
    def test_r36_card_label_not_cut(self):
        self.home()
        for n in self.page.locator('.tile-name').all():self.assertLessEqual(n.evaluate('(e)=>e.scrollWidth'),n.evaluate('(e)=>e.clientWidth')+1,n.inner_text())
    def test_r37_cards_within_safe_x(self):
        self.home()
        for r in self.page.locator('.app-tile').evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().toJSON())'):
            self.assertGreaterEqual(r['left'],1280*.04)
            self.assertLessEqual(r['right'],1280*.96)
    def test_r38_focus_visible_after_down(self):self.home();self.k('ArrowDown');self.assertTrue(self.page.locator('.app-tile').first.evaluate('(e)=>getComputedStyle(e).borderTopColor')!='rgba(0, 0, 0, 0)')
    def test_r39_focus_no_overlap(self):self.geometry(1280,720)
    def test_r40_browser_label(self):self.home();self.assertEqual(self.page.locator('.app-tile[data-id="browser"] .tile-name').inner_text(),'Браузер')
    def test_r41_detail_aria(self):self.home();self.k('ArrowDown','Enter');self.assertEqual(self.page.evaluate('document.activeElement.id'),'detail-back')
    def test_p42_kion_tile(self):self.home();self.assertEqual(self.page.locator('.app-tile[data-id="kion"] .tile-name').inner_text(),'КИОН')
    def test_p43_kion_from_dpad(self):self.home();self.k('ArrowDown','ArrowRight','ArrowRight','ArrowRight','ArrowRight','ArrowDown');self.assertEqual(self.page.evaluate('document.activeElement.getAttribute("data-id")'),'kion')
    def test_r44_kion_returns_to_home(self):self.home();self.k('ArrowDown','ArrowRight','ArrowRight','ArrowRight','ArrowRight','ArrowDown','Enter','Escape');self.assertEqual(self.screen(),'home')
    def test_r45_no_extra_row(self):self.home();self.assertEqual(self.page.locator('.app-tile').count(),10)
    def test_p46_lightweight_profile_enabled(self):
        self.assertTrue(self.page.locator('body').evaluate('(e)=>e.classList.contains("performance-lite")'))
    def test_p47_tile_blur_hidden(self):
        self.home();self.assertEqual(self.page.locator('.tile-glow').first.evaluate('(e)=>getComputedStyle(e).display'),'none')
    def test_r48_no_focus_zoom(self):
        self.home();self.k('ArrowDown');self.assertEqual(self.page.locator('.is-focused').first.evaluate('(e)=>getComputedStyle(e).transform'),'none')
    def test_r49_no_focus_transition(self):
        self.home();self.k('ArrowDown');self.assertEqual(self.page.locator('.is-focused').first.evaluate('(e)=>getComputedStyle(e).transitionDuration'),'0s')
    def test_r50_no_external_fonts(self):
        self.assertEqual(self.page.locator('link[href^="http"]').count(),0)
    def geometry(self,w,h):
        self.page.set_viewport_size({'width':w,'height':h});self.home()
        selectors=['.app-tile','.quick-action','#tv-card']
        coords=self.page.locator(','.join(selectors)).evaluate_all('''els=>els.map(e=>{var r=e.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}})''')
        self.assertEqual(len(coords),15)
        for r in coords:
            self.assertGreaterEqual(r['x'],w*.035)
            self.assertGreaterEqual(r['y'],h*.025)
            self.assertLessEqual(r['x']+r['w'],w*.965)
            self.assertLessEqual(r['y']+r['h'],h*.965)
        for i,a in enumerate(coords):
            for j,b in enumerate(coords):
                if i>=j:continue
                overlap=max(0,min(a['x']+a['w'],b['x']+b['w'])-max(a['x'],b['x']))*max(0,min(a['y']+a['h'],b['y']+b['h'])-max(a['y'],b['y']))
                self.assertAlmostEqual(overlap,0,delta=.01,msg=f'{w}x{h} overlap {i}/{j}')
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight'))
if __name__=='__main__':unittest.main()