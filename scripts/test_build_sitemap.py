#!/usr/bin/env python3
"""Tests for scripts/build_sitemap.py. Stdlib only.

Run: python3 -I -m unittest discover -s scripts -p 'test_*.py'
"""
import tempfile
import unittest
from pathlib import Path

import build_sitemap as bs

# The item list from the bug report: dead, blocked and unreachable game targets
# must not reach sitemap.xml. status 0 means the host did not answer.
STATUS = {
    "https://sz-games.github.io/Games5/live/": 200,
    "https://mr-funkinguy.github.io/75/projects/smashkarts/index.html": 404,
    "https://tbg95.github.io/moto-x3m/game": 404,
    "https://webglmath.github.io/drift-hunters/": 404,
    "https://images-opensocial.googleusercontent.com/gadgets/ifr": 404,
    "https://v6p9d9t4.ssl.hwcdn.net/html/8805247/UZG/index.html": 0,
    "https://blocked.example/game": 403,
}
ENTRIES = [(url, f"https://sz-games.github.io/games/game.html?game={url}")
           for url in STATUS]


def check(url):
    return STATUS[url]


class SelectGamesTest(unittest.TestCase):
    def test_keeps_only_targets_that_answer_200(self):
        kept, skipped = bs.select_games(ENTRIES, check)
        self.assertEqual([e[0] for e in kept], ["https://sz-games.github.io/Games5/live/"])
        self.assertEqual([e[0] for e in skipped], [e[0] for e in ENTRIES[1:]])
        self.assertEqual(dict(skipped)["https://blocked.example/game"], 403)
        self.assertEqual(
            dict(skipped)["https://v6p9d9t4.ssl.hwcdn.net/html/8805247/UZG/index.html"], 0)

    def test_allowlist_forces_a_target_back_in(self):
        kept, skipped = bs.select_games(ENTRIES, check, allow=["https://blocked.example/game"])
        self.assertIn("https://blocked.example/game", [e[0] for e in kept])
        self.assertNotIn("https://blocked.example/game", [e[0] for e in skipped])

    def test_allowlist_matches_a_url_variant(self):
        # A trailing slash or /index.html is the same game, as in game_urls().
        kept, _ = bs.select_games(
            [("https://gone.example/game/", "url")],
            lambda url: 404,
            allow=["https://gone.example/game/index.html"])
        self.assertEqual([e[0] for e in kept], ["https://gone.example/game/"])

    def test_allowlisted_target_is_not_probed(self):
        probed = []

        def flaky(url):
            probed.append(url)
            return 503

        kept, _ = bs.select_games(
            [("https://blocked.example/game", "url")], flaky,
            allow=["https://blocked.example/game"])
        self.assertEqual(len(kept), 1)
        self.assertEqual(probed, [])


class LoadAllowTest(unittest.TestCase):
    def test_reads_urls_and_ignores_comments_and_blanks(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sitemap-allow.txt"
            path.write_text("# comment\n\nhttps://a.example/game/\n  https://b.example/game/  # why\n")
            self.assertEqual(bs.load_allow(path),
                             ["https://a.example/game/", "https://b.example/game/"])

    def test_missing_file_means_no_allowlist(self):
        self.assertEqual(bs.load_allow(Path("/nonexistent/sitemap-allow.txt")), [])


if __name__ == "__main__":
    unittest.main()
