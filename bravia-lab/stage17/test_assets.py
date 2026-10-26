#!/usr/bin/env python3
"""Regression contract: both Stage17 entrypoints must generate identical assets."""
import hashlib
import json
import subprocess
import sys
import unittest
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
STATES = {"unknown": (0, 0.14), "ready": (1, 0.22), "unavailable": (2, 0.08)}

class BackplateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run([sys.executable, str(HERE / "build_assets.py")], check=True)
        subprocess.run(["make", "-C", str(ROOT / "native_core"), "render_dump"], check=True)
        cls.manifest_path = HERE / "assets" / "manifest.json"
        cls.assets = json.loads(cls.manifest_path.read_text(encoding="utf-8"))

    def test_asset_count_and_unique_variants(self):
        self.assertEqual(len(self.assets), 30)
        self.assertEqual(
            {(a["id"], a["status"]) for a in self.assets},
            {(i, s) for i in range(10) for s in STATES},
        )
        self.assertEqual(len({a["filename"] for a in self.assets}), 30)

    def test_manifest_matches_artifacts_and_opacity(self):
        for item in self.assets:
            with self.subTest(item=item["filename"]):
                variant, opacity = STATES[item["status"]]
                self.assertEqual(item["id"], int(item["filename"].split("_", 1)[0]))
                self.assertEqual(item["width"], 144)
                self.assertEqual(item["height"], 75)
                self.assertEqual(item["source"] in ("Simple Icons vector", "project wordmark fallback"), True)
                data = (HERE / "assets" / item["filename"]).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), item["sha256"])
                with Image.open(HERE / "assets" / item["filename"]) as image:
                    self.assertEqual(image.size, (144, 75))
                    self.assertEqual(image.mode, "RGBA")
                    maximum = image.getchannel("A").getextrema()[1]
                    self.assertGreater(maximum, 0)
                    self.assertLessEqual(maximum, round(255 * opacity) + 1)

    def test_monotone_status_strength(self):
        for i in range(10):
            sums = {}
            for item in self.assets:
                if item["id"] == i:
                    with Image.open(HERE / "assets" / item["filename"]) as im:
                        sums[item["status"]] = sum(im.getchannel("A").getdata())
            self.assertGreater(sums["ready"], sums["unknown"])
            self.assertGreater(sums["unknown"], sums["unavailable"])

    def test_legacy_entrypoint_is_deterministic(self):
        before = self.manifest_path.read_bytes()
        subprocess.run([sys.executable, str(HERE / "generate_assets.py")], check=True)
        self.assertEqual(before, self.manifest_path.read_bytes())

    def test_native_renderer_logo_commands_and_truthful_status(self):
        raw = subprocess.check_output([
            str(ROOT / "native_core" / "render_dump"),
            "1280", "720", "home", "apps", "3", "demo",
        ], text=True)
        logos = [json.loads(row) for row in raw.splitlines() if json.loads(row)[0] == 4]
        self.assertEqual([x[11] for x in logos], list(range(10)))
        self.assertEqual([x[12] for x in logos], [0,0,0,1,0,0,0,0,0,2])
        raw_default = subprocess.check_output([
            str(ROOT / "native_core" / "render_dump"),
            "1280", "720", "home",
        ], text=True)
        unknown = [json.loads(row)[12] for row in raw_default.splitlines() if json.loads(row)[0] == 4]
        self.assertEqual(unknown, [0] * 10)

    def test_native_titles_preserved(self):
        raw = subprocess.check_output([
            str(ROOT / "native_core" / "render_dump"),
            "1280", "720", "home",
        ], text=True)
        labels = [json.loads(x)[9] for x in raw.splitlines()]
        for name in ("Кинопоиск", "Иви", "START", "Netflix", "YouTube", "RUTUBE",
                     "Media Station X", "Al(co)pac", "Браузер", "КИОН"):
            self.assertIn(name, labels)

if __name__ == "__main__":
    unittest.main(verbosity=2)
