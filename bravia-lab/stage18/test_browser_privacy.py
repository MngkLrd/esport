"""Stage18.2: off-device Chromium checks for CSP and unsolicited HOME traffic.

This deliberately tests only the authored HTML prototype, NOT Sony's Cobalt
engine, native firmware or third-party video applications.
"""
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright

UI = Path(__file__).resolve().parents[1] / "ui"

def bundled_home():
    html = (UI / "index.html").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="style.css">',
                        "<style>" + (UI / "style.css").read_text(encoding="utf-8") + "</style>")
    for name in ("app-data.js", "sony_native_bridge.js", "sony_catalog_bridge.js", "launcher.js"):
        html = html.replace('<script src="' + name + '"></script>',
                            "<script>" + (UI / name).read_text(encoding="utf-8") + "</script>")
    return html

class BrowserPrivacyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path="/usr/bin/chromium",
            headless=True,
            args=["--no-sandbox"],
        )

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context()
        self.page = self.context.new_page()
        self.requests = []
        self.page.on("request", lambda request: self.requests.append(request.url))
        self.page.set_content(bundled_home())

    def tearDown(self):
        self.context.close()

    def test_home_has_zero_background_network_requests(self):
        self.page.keyboard.press("h")
        self.page.keyboard.press("ArrowDown")
        self.page.keyboard.press("ArrowRight")
        self.page.keyboard.press("Enter")
        self.assertEqual(self.requests, [])
        self.assertEqual(self.page.locator("body").get_attribute("data-screen"), "detail")

    def test_connect_src_blocks_script_network(self):
        result = self.page.evaluate("""async () => {
          try {
            await fetch('https://privacy-probe.invalid/should-never-leave');
            return 'unexpected success';
          } catch(e) {
            return 'blocked';
          }
        }""")
        self.assertEqual(result, "blocked")
        self.assertEqual(self.requests, [])
        csp = self.page.locator('meta[http-equiv="Content-Security-Policy"]').get_attribute("content")
        self.assertIn("connect-src 'none'", csp)

    def test_remote_image_pixel_is_not_requested(self):
        self.page.evaluate("""() => {
          const pixel = document.createElement('img');
          pixel.src = 'https://privacy-probe.invalid/tracking-pixel.gif';
          document.body.appendChild(pixel);
        }""")
        self.page.wait_for_timeout(150)
        self.assertEqual(self.requests, [])
        self.assertEqual(self.page.locator('meta[name="referrer"]').get_attribute("content"), "no-referrer")

if __name__ == "__main__":
    unittest.main(verbosity=2)
