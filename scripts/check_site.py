#!/usr/bin/env python3
"""Check internal links, sitemap.xml and canonical tags. Stdlib only.

Usage: python3 scripts/check_site.py [root]
Exit 1 if any check fails. Known-broken links live in scripts/link-baseline.txt.
"""
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

HOST = "sz-games.github.io"
SKIP_DIRS = {".git", ".github", ".worktrees", "node_modules"}
NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.canonical = None
        self.noindex = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "link" and "canonical" in (a.get("rel") or "").lower().split():
            self.canonical = a.get("href")
            return
        if tag == "meta" and (a.get("name") or "").lower() == "robots":
            self.noindex = "noindex" in (a.get("content") or "").lower()
        if tag in ("a", "link", "script", "img", "iframe", "source"):
            for k in ("href", "src"):
                if a.get(k):
                    self.links.append(a[k])


def resolve(root, page, ref):
    """Return the local path a reference points to, or None if external/ignored."""
    ref = ref.strip()
    if not ref or ref.startswith(("#", "mailto:", "tel:", "javascript:", "data:", "blob:")):
        return None
    u = urlparse(ref)
    if u.scheme or ref.startswith("//"):
        if u.netloc != HOST:
            return None
        path = u.path
    else:
        path = u.path
    if not path:
        return None
    path = unquote(path)
    base = root / path.lstrip("/") if path.startswith("/") or u.netloc else page.parent / path
    return base


def exists(p):
    return p.is_file() or (p.is_dir() and (p / "index.html").is_file())


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    pages = [p for p in root.rglob("*.html")
             if not SKIP_DIRS & set(p.relative_to(root).parts)]
    base_file = root / "scripts" / "link-baseline.txt"
    baseline = set()
    if base_file.exists():
        baseline = {l.strip() for l in base_file.read_text().splitlines()
                    if l.strip() and not l.startswith("#")}
    errors = []
    parsed = {}

    for p in sorted(pages):
        rel = p.relative_to(root).as_posix()
        parser = Page()
        parser.feed(p.read_text(errors="replace"))
        parsed[rel] = parser
        for ref in parser.links:
            target = resolve(root, p, ref)
            if target is not None and not exists(target):
                key = f"{rel} -> {ref}"
                if key not in baseline:
                    errors.append(f"broken link: {key}")

    sm = root / "sitemap.xml"
    seen = set()
    for loc in ET.parse(sm).getroot().iter(NS + "loc"):
        url = (loc.text or "").strip()
        u = urlparse(url)
        if u.netloc != HOST:
            errors.append(f"sitemap: wrong host: {url}")
            continue
        if url in seen:
            errors.append(f"sitemap: duplicate: {url}")
        seen.add(url)
        path = root / unquote(u.path).lstrip("/")
        if not exists(path):
            errors.append(f"sitemap: no file for {url}")
            continue
        page = path / "index.html" if path.is_dir() else path
        if page.suffix != ".html":
            continue
        info = parsed.get(page.relative_to(root).as_posix())
        if info is None:
            continue
        if info.noindex:
            errors.append(f"sitemap: noindex page listed: {url}")
        if info.canonical and info.canonical != url:
            errors.append(f"canonical mismatch: {url} has canonical {info.canonical}")

    # Every canonical on any page must be an absolute URL on this host that exists.
    for rel, info in parsed.items():
        if not info.canonical:
            continue
        u = urlparse(info.canonical)
        if u.netloc != HOST or u.scheme != "https":
            errors.append(f"canonical not https://{HOST}: {rel} -> {info.canonical}")
        elif not exists(root / unquote(u.path).lstrip("/")):
            errors.append(f"canonical target missing: {rel} -> {info.canonical}")

    for e in errors:
        print(e)
    print(f"checked {len(pages)} pages, {len(seen)} sitemap URLs, {len(errors)} problems")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
