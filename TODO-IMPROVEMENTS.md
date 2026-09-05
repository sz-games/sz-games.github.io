# TODO — Sz Games site improvements

Scope: this project only (`sz-games.github.io`). No bridge / workspace files.

## Done (2026-09-05)
- [x] Removed redundant `style` overrides on ~300 `.textover` cards (identical to
      base class — pure no-ops) → `class="textover"`
- [x] Removed `style="position:relative;float:left"` (covered by `.box`)
- [x] `style="text-decoration:none"` → `.link-plain` class
- [x] Menu / close icon inline styles → `.icon-btn`, `.icon-btn--menu`, `.icon-btn--close`
- [x] a11y: missing `alt` on 404 image; missing `width`/`height` on 9 imgs
- [x] Prod log cleanup: `Global.js`, `GlobalSettings.js`, `nohist.js`,
      `script.js` — logs gated behind `?debug` / removed
- [x] Renamed `GobalSettings.js` → `GlobalSettings.js` + updated all refs
- [x] Maintenance video (`BGVIDLOW.mp4` 23 MB): only set when maintenance mode
      is on, `preload="none"`, no autoplay

## Done (2026-09-05, round 2)
- [x] `games.js`: `'Casual Shooter Multiplayer'` → proper array (filter uses
      substring match, join output identical — no behavior change)
- [x] `script.js`: removed duplicate `filterByCategory` (identical twin)
- [x] Removed 23 MB `BGVIDLOW.mp4` — zero `<video>` tags site-wide, only a
      guarded JS ref to a nonexistent element. Dead JS block removed too.
- [x] Removed 30 orphan `icons/apple-splash-*` + `apple-icon-180.png`
      (~1.4 MB, never linked from any page — browsers never fetched them)
- [x] Fixed `class="featgameit" featgameit--row` bare-attribute bug (5×) —
      the `--row` class never applied before
- [x] **Mobile responsive**: fluid `#games` grid + auto-height covers,
      scroll-snap featured row (`min-width:400px` overflow fixed),
      full-width menu overlay capped at 325px, tighter TopMenu/notice
      boxes, 13px card labels. Desktop rules untouched.
- [x] Verified keepers: `Offline.html` (service-worker fallback),
      `beforeop.html` (linked), `fake-domains.html` (SEO defensive page),
      `testing/` (linked from index + gameT)

## Still open (project-scoped, biggest first)
- [ ] **Image weight** — `cover/` is 31 MB (289 PNG + 42 JPEG + 18 JPG;
      only 58 WebP + 14 AVIF). No conversion tools in this container —
      needs a pass with `cwebp`/`sharp` + URL updates in `games.js`/
      `index.html`. `games/` (276 MB) is mostly game binaries
      (unity/wasm/swf), not images — not optimizable as images.
- [ ] **`games.js` data hygiene** — already data-driven; normalize `categories`
      (mixed `"Casual Shooter Multiplayer"` single-string vs arrays), dedupe
      `imgSrc` hosts (github blob `?raw=true` vs `raw.githubusercontent.com`
      vs local), add missing `alt` per entry.
- [ ] **`styles.css` `!important` audit** — base `.textover`/`MenuIt` still use
      `!important`; remove where specificity allows, keep visual identical.
- [ ] **Video poster** — add lightweight poster image for maintenance screen
      so no black flash before 23 MB video loads.
- [ ] **Dead pages check** — verify `Offline.html`, `beforeop.html`,
      `fake-domains.html`, `testing/` are still linked; remove or noindex.
- [ ] **PWA icons** — `icons/` has ~20 apple splash screens (~1.4 MB);
      confirm `manifest.json` references only what's needed.

## Out of scope (other projects — do NOT touch from here)
- `agent-bridge-server.js` token hardening (bridge project)
- `/workspace/serve-tunnel.sh`, tunnel logs (workspace infra)
- `/workspace/tetris.html` (separate experiment)
