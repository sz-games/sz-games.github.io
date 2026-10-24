#!/usr/bin/env python3
"""Build sitemap.xml from games.js and a fixed list of site pages. Stdlib only.

Usage: python3 scripts/build_sitemap.py
Game URLs use the same canonical form that games/game.html sets in the browser:
/games/game.html?game=<game URL>. <lastmod> is the date of the last git commit
that touched the page file, or, for a game, that added or removed its games.js entry.
"""
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote, quote
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "https://sz-games.github.io"
MARKER = "game.html?game="

# (path, priority). Utility pages (BetaTest, IMAGEAI, MessageUN, settings, rating,
# Menu, Chat) are left out on purpose.
PAGES = [
    ("", "1.00"),
    ("Bitlife.html", "0.80"), ("FNF.html", "0.80"), ("Slope.html", "0.80"),
    ("beforeop.html", "0.80"), ("games/infinite-road/", "0.80"), ("roblox.html", "0.80"),
    ("About.html", "0.60"), ("Blog.html", "0.60"), ("FAQ.html", "0.60"),
    ("StartFNF.html", "0.60"), ("reviews.html", "0.60"), ("sz-brawlers.html", "0.60"),
    ("Privacy-Policy.html", "0.40"), ("contact.html", "0.40"), ("partners.html", "0.40"),
    ("terms-of-service.html", "0.40"),
    ("RammerheadProxys.html", "0.30"), ("fake-domains.html", "0.30"),
]


def normalise(value):
    v = value.strip()
    if v.startswith(ORIGIN + "/"):
        v = v[len(ORIGIN):]
    elif v.startswith("http://sz-games.github.io/"):
        v = v[len("http://sz-games.github.io"):]
    elif not v.startswith("/") and not v.startswith("http"):
        return ""
    return ORIGIN + v if v.startswith("/") else v


def key_of(value):
    return re.sub(r"/index\.html$", "", re.sub(r"/+$", "", value))


def game_urls(text):
    """Game viewer targets from games.js, one per game, first entry wins (as in game.html)."""
    seen, out = set(), []
    for url in re.findall(r"url:\s*'([^']*)'", text):
        i = url.find(MARKER)
        if i < 0:
            continue
        target = unquote(url[i + len(MARKER):].split("&")[0])
        canonical = normalise(target)
        if canonical and key_of(canonical) not in seen:
            seen.add(key_of(canonical))
            out.append((canonical, url))
    return out


def git_date(*args):
    r = subprocess.run(["git", "log", "-1", "--format=%cs", *args], cwd=ROOT,
                       capture_output=True, text=True, check=True)
    return r.stdout.strip()


def entry(loc, lastmod, priority):
    return (f"  <url>\n    <loc>{escape(loc)}</loc>\n    <lastmod>{lastmod}</lastmod>\n"
            f"    <priority>{priority}</priority>\n  </url>\n")


def main():
    parts = []
    for path, priority in PAGES:
        f = path or "index.html"
        f = f + "index.html" if f.endswith("/") else f
        parts.append(entry(f"{ORIGIN}/{path}", git_date("--", f), priority))
    games_js = (ROOT / "games.js").read_text()
    for canonical, raw in game_urls(games_js):
        loc = f"{ORIGIN}/games/game.html?game=" + quote(canonical, safe=":/?=&%")
        date = git_date("-S" + raw, "--", "games.js") or git_date("--", "games.js")
        parts.append(entry(loc, date, "0.70"))
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(parts) + "</urlset>\n")
    (ROOT / "sitemap.xml").write_text(xml)
    print(f"wrote {len(parts)} URLs")


if __name__ == "__main__":
    main()
