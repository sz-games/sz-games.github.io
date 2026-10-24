# SZ Games (sz-games.github.io)

A static unblocked-games portal for school students: 250+ browser games (HTML5, WebGL, Flash via Ruffle), retro emulators, tab cloaking, a panic button and an about:blank launcher. Built by Bobby; run by Senty.

- Live: https://sz-games.github.io/
- Repo: https://github.com/sz-games/sz-games.github.io (default branch `main`)
- Not the same site as sz-games.com (repo `docklib/docklib.github.io`, Kamal on themarzlibrary) or sz.games (`senty-au/sz.games`). Only the games are shared. rus decided on 2026-10-01 to keep them separate.

## Stack
Plain HTML, CSS and vanilla JavaScript. No build step, no package manager, no backend. A one-line `_config.yml` (Jekyll cache header) is all GitHub Pages reads. Python 3 (stdlib only) runs the CI check.

## Run locally
```bash
python3 -m http.server 8000      # then open http://localhost:8000
python3 scripts/build_sitemap.py     # rebuild sitemap.xml from games.js (probes each game target)
python3 -I scripts/check_site.py # links, sitemap.xml, canonical tags (same as CI)
python3 -I -m unittest discover -s scripts -p 'test_*.py'   # tests
```

## Deploy
GitHub Pages, legacy "build from branch": every push to `main` is published from `/`. There is no CNAME and no deploy workflow. The only workflow is `.github/workflows/site-check.yml` (runs `scripts/check_site.py` and the script tests on push and pull request; it does not deploy).

## Connected services
| Service | Detail |
|---|---|
| Plausible | `data-domain="sz-games.github.io"`, script from stats.senty.com.au |
| Google Analytics 4 / Tag Manager | `G-C78TXR0XFK`, GTM `GTM-P93VS8N5` |
| Google AdSense | publisher `ca-pub-3723218062742398`; `ads.txt` also lists Setupad and Aniview records |
| Search Console / my-seo | property for `sz-games.github.io` (listed in fleet `sites.toml`); content and SEO changes are annotated in my-seo, not here |
| Firebase Realtime Database | only `Chat.html` (client key in the page) |

## Backups
No server state. The repo is the backup (about 296 MB checked out; GitHub reports 260 MB). Nothing else needs backing up.

## Docs
- [GEMINI.md](GEMINI.md): site structure and how to add a game
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/CHANGELOG-TECH.md](docs/CHANGELOG-TECH.md)
- [docs/PROPOSALS.md](docs/PROPOSALS.md)
- [docs/AUDIT-2026-10.md](docs/AUDIT-2026-10.md): the October 2026 audit
- [SECURITY.md](SECURITY.md)

## Owner and notes
Owner: Senty (rus). Fork rules from the original author: keep a link to the original site and the credits; do not rebrand. Browser extension: [Chrome](https://chromewebstore.google.com/detail/sz-games-portable/hbclpfdbinpmdgcglhmkngpabafdeaim), [Firefox](https://addons.mozilla.org/en-US/firefox/addon/sz-games-portable/). Discord: https://discord.gg/DzKRSntb87

