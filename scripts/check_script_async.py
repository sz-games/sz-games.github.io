#!/usr/bin/env python3
"""Fail if an outside <script src> (other host) has neither async nor defer.

Usage: python3 -I scripts/check_script_async.py [root]
Scans *.html under root (skips .git, docs, node_modules). Stdlib only.
"""
import os
import sys
from html.parser import HTMLParser

SKIP = {".git", "docs", "node_modules", ".worktrees"}
# Non-ad tool pages whose inline code needs the library synchronously
# (jQuery/OpenLayers, p5/ml5, Tailwind Play CDN). Not part of the ad sweep.
ALLOW = {"weather", "IMAGEAI.html", "sz-brawlers.html"}


class Finder(HTMLParser):
    def __init__(self):
        super().__init__()
        self.bad = []

    def handle_starttag(self, tag, attrs):
        if tag != "script":
            return
        a = dict(attrs)
        src = a.get("src") or ""
        if not src.startswith(("http://", "https://", "//")):
            return
        if "async" in a or "defer" in a or a.get("type") == "module":
            return
        self.bad.append((self.getpos()[0], src))


def scan(root):
    out = []
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in SKIP]
        for f in files:
            p = os.path.join(d, f)
            rel = os.path.relpath(p, root).split(os.sep)
            if f.endswith(".html") and rel[0] not in ALLOW:
                fd = Finder()
                with open(p, encoding="utf-8", errors="replace") as fh:
                    fd.feed(fh.read())
                out += [(p, n, s) for n, s in fd.bad]
    return out


if __name__ == "__main__":
    bad = scan(sys.argv[1] if len(sys.argv) > 1 else ".")
    for p, n, s in bad:
        print(f"{p}:{n}: outside script without async/defer: {s}")
    sys.exit(1 if bad else 0)
