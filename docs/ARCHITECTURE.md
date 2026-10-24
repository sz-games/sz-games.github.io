# Architecture

A static site served as-is by GitHub Pages. No server code, no database.

## Components
- `index.html`, `styles.css`, `scripts.js`: the home page. The game cards are written in `index.html` under `#games` on purpose, so crawlers see them. `scripts.js` only adds search, category filter and scrolling.
- `games/`: one folder or HTML file per game (about 250 files, 277 MB; Flash `.swf` files play through Ruffle, Unity builds are `.unityweb`). `games/infinite-road/` is the newest, built from the car-game repo.
- `cover/`, `images/`, `icons/`: thumbnails and art.
- Other pages in the root: About, FAQ, Blog, Menu, settings, Privacy-Policy, terms-of-service, partners, reviews, roblox, proxy list pages, and others. Page names are mixed case on purpose; URLs are case sensitive.
- `games.js`, `script.js`, `beforeop.html`: legacy catalogue code, not used by the home page.
- `Games5/`, `testing/`, `weather/`: small old or experimental folders.
- `service-worker.js`: a kill switch. It unregisters itself and clears caches for visitors who still have the old worker. Delete it once that is no longer needed.
- `sitemap.xml` is built by `python3 scripts/build_sitemap.py` (games.js + page list). `robots.txt`, `ads.txt`: edited by hand.
- `scripts/check_site.py` and `scripts/link-baseline.txt`: CI check. Known broken links are listed in the baseline.

## Data flow
Browser loads HTML from GitHub Pages, then loads the game from `games/` inside an iframe or the game viewer page. Scripts call out to AdSense, Google Tag Manager and Analytics, and Plausible (stats.senty.com.au). `Chat.html` talks to a Firebase Realtime Database. The browser keeps settings and cloak choices in localStorage.

## External services
Plausible, Google Analytics 4 and Tag Manager, AdSense (plus Setupad and Aniview lines in ads.txt), Firebase (Chat page), Ruffle (Flash). Cloudflare is not used.

## Environment variables
None. Nothing is built or run on a server.

## Deploy
Push to `main`. GitHub Pages builds it (legacy mode, folder `/`). A merged PR is live in about a minute.
