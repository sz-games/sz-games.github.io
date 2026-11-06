"""Tests for adsterra-banner.js: late load, own key, banner format only. Stdlib only."""
import json
import re
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OWN_KEY = "5ee99841a6801f0f3742958ab80c87bb"

HARNESS = r"""
const fs = require('fs');
const src = fs.readFileSync(process.argv[1], 'utf8');
const width = Number(process.argv[2]);
const box = { style: {}, children: [], appendChild(c) { this.children.push(c) } };
const timers = [];
let onLoad;
global.window = { innerWidth: width, addEventListener(_, fn) { onLoad = fn } };
global.document = {
  getElementById: () => box,
  createElement: () => ({ style: {}, setAttribute() {} }),
};
global.setTimeout = (fn, ms) => timers.push({ fn, ms });
eval(src);
const out = { before: box.children.length };
onLoad();
out.delay = timers.length ? timers[0].ms : null;
out.beforeTimer = box.children.length;
if (timers.length) timers[0].fn();
out.after = box.children.length;
out.display = box.style.display || '';
out.srcdoc = box.children.length ? box.children[0].srcdoc : '';
console.log(JSON.stringify(out));
"""


def run(width):
    if not shutil.which("node"):
        raise unittest.SkipTest("node missing")
    r = subprocess.run(
        ["node", "-e", HARNESS, str(ROOT / "adsterra-banner.js"), str(width)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(r.stdout)


class AdsterraBanner(unittest.TestCase):
    def test_loads_late_with_own_key(self):
        o = run(1280)
        self.assertEqual(o["before"], 0)
        self.assertEqual(o["beforeTimer"], 0)
        self.assertGreaterEqual(o["delay"], 3000)
        self.assertEqual(o["after"], 1)
        self.assertEqual(o["display"], "block")
        self.assertEqual(re.findall(r"[0-9a-f]{32}", o["srcdoc"]), [OWN_KEY, OWN_KEY])

    def test_banner_format_only(self):
        o = run(1280)
        self.assertIn("format:'iframe'", o["srcdoc"])
        self.assertNotRegex(o["srcdoc"], r"popunder|smartlink|social")

    def test_nothing_on_narrow_screens(self):
        o = run(500)
        self.assertEqual(o["after"], 0)
        self.assertEqual(o["display"], "")

    def test_slot_reserves_height_in_index(self):
        html = (ROOT / "index.html").read_text()
        m = re.search(r'<div id="adsterra-banner-728x90"[^>]*>', html)
        self.assertIsNotNone(m)
        self.assertIn("height: 90px", m.group(0))
        self.assertEqual(html.count("adsterra-banner.js"), 1)


if __name__ == "__main__":
    unittest.main()
