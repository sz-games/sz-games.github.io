"""Tests for the game viewer's JS head tags and the beforeop.html head. Stdlib only."""
import json
import re
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Minimal DOM: enough for the viewer's head script to run under node.
HARNESS = r"""
const els = [];
function el(tag) {
  const a = {};
  return { tag, a, setAttribute(k, v) { a[k] = v }, getAttribute(k) { return a[k] } };
}
let ready;
global.window = { location: { search: process.argv[1] } };
global.document = {
  title: '',
  createElement: el,
  addEventListener(_, fn) { ready = fn },
  head: { appendChild(e) { els.push(e) }, querySelector() { return null } },
};
global.gamesData = [{ name: 'Slope', url: 'https://sz-games.github.io/games/game.html?game=/slope/' }];
eval(require('fs').readFileSync(0, 'utf8'));
ready();
console.log(JSON.stringify(els.map((e) => e.a)));
"""


def viewer_script():
    html = (ROOT / "games/game.html").read_text()
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    return next(s for s in scripts if "DOMContentLoaded" in s and "gamesData" in s)


def head_tags(search):
    out = subprocess.run(["node", "-e", HARNESS, search], input=viewer_script(),
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


@unittest.skipUnless(shutil.which("node"), "node not installed")
class ViewerHeadTest(unittest.TestCase):
    def test_bare_viewer_is_noindex(self):
        self.assertIn({"name": "robots", "content": "noindex, follow"}, head_tags(""))

    def test_known_game_gets_self_canonical_and_no_noindex(self):
        tags = head_tags("?game=/slope/")
        self.assertIn({"rel": "canonical", "href": "https://sz-games.github.io/games/game.html?game=https://sz-games.github.io/slope/"}, tags)
        self.assertFalse(any(t.get("name") == "robots" for t in tags))

    def test_unknown_game_is_not_noindexed(self):
        self.assertEqual(head_tags("?game=/not-a-game/"), [])


class BeforeopHeadTest(unittest.TestCase):
    def head(self, page):
        html = (ROOT / page).read_text()
        title = re.search(r"<title>(.*?)</title>", html).group(1)
        og = re.search(r'property="og:title" content="([^"]*)"', html).group(1)
        descs = re.findall(r'name="description"[^>]*?content="([^"]*)"', html, re.S)
        return title, og, descs

    def test_beforeop_head_differs_from_home(self):
        title, og, descs = self.head("beforeop.html")
        home_title, home_og, home_descs = self.head("index.html")
        self.assertEqual(len(descs), 1)
        self.assertNotEqual(title, home_title)
        self.assertNotEqual(og, home_og)
        self.assertNotEqual(descs, home_descs)
        self.assertIn("Beta Test Portal", title)


if __name__ == "__main__":
    unittest.main()
