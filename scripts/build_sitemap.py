#!/usr/bin/env python3
"""Build sitemap.xml from games.js and a fixed list of site pages. Stdlib only.

Usage: python3 scripts/build_sitemap.py

Game URLs use the same canonical form that games/game.html sets in the browser:
/games/game.html?game=<game URL>. <lastmod> is the date of the last git commit
that touched the page file, or, for a game, that added or removed its games.js entry.

A game is listed only when its target answers HTTP 200 to a request like a
browser makes. A dead or unreachable game stays on the site but leaves the
sitemap. When a live game fails the check (bot protection, brief outage), put
its target URL in scripts/sitemap-allow.txt to keep it listed.
"""
import re
import subprocess
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote, unquote
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "https://sz-games.github.io"
MARKER = "game.html?game="
ALLOW_FILE = ROOT / "scripts" / "sitemap-allow.txt"

# The check sends the user agent of a desktop browser: some live games answer
# 403 to a bare bot request and 200 to a browser, and those games work for a
# visitor, so the check must not drop them.
BROWSER_UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
PROBE_TIMEOUT = 10
PROBE_WORKERS = 12

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


def probe(url):
    """HTTP status of a game target, as a browser sees it. 0 when it does not answer."""
    request = urllib.request.Request(
        quote(url, safe=":/?=&%"),
        headers={"User-Agent": BROWSER_UA,
                 "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"})
    try:
        with urllib.request.urlopen(request, timeout=PROBE_TIMEOUT) as response:
            response.read(2048)
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except Exception:
        return 0


def select_games(entries, check=probe, allow=()):
    """Split (canonical, raw) entries into (kept, skipped), skipped as (canonical, status).

    A target is kept when it answers 200 or when the allowlist names it. The
    allowlist wins without a request, so a flaky site cannot drop out of the
    sitemap. `check` is a callable(url) -> status, so tests never use the network.
    """
    allowed = {key_of(url) for url in allow}
    todo = [e for e in entries if key_of(e[0]) not in allowed]
    with ThreadPoolExecutor(max_workers=PROBE_WORKERS) as pool:
        status = dict(zip((key_of(e[0]) for e in todo),
                          pool.map(lambda e: check(e[0]), todo)))
    kept, skipped = [], []
    for canonical, raw in entries:
        key = key_of(canonical)
        if key in allowed or status.get(key) == 200:
            kept.append((canonical, raw))
        else:
            skipped.append((canonical, status.get(key, 0)))
    return kept, skipped


def load_allow(path):
    """Target URLs from the allowlist file: one per line, # starts a comment."""
    if not path.is_file():
        return []
    urls = []
    for line in path.read_text().splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            urls.append(line)
    return urls


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
    games = game_urls((ROOT / "games.js").read_text())
    listed, skipped = select_games(games, allow=load_allow(ALLOW_FILE))
    for canonical, raw in listed:
        loc = f"{ORIGIN}/games/game.html?game=" + quote(canonical, safe=":/?=&%")
        date = git_date("-S" + raw, "--", "games.js") or git_date("--", "games.js")
        parts.append(entry(loc, date, "0.70"))
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(parts) + "</urlset>\n")
    (ROOT / "sitemap.xml").write_text(xml)
    if skipped:
        print(f"{len(skipped)} games left out (target did not answer 200; "
              f"scripts/sitemap-allow.txt can keep one in):", file=sys.stderr)
        for canonical, status in skipped:
            print(f"  {status or 'no response'}: {canonical}", file=sys.stderr)
    print(f"wrote {len(parts)} URLs, {len(listed)} games")


if __name__ == "__main__":
    main()
