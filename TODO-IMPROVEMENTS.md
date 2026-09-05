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

## Still open (project-scoped, biggest first)
- [ ] **Image weight** — `games/` 276 MB + `cover/` 31 MB. Convert hero/cover
      to WebP/AVIF, compress, keep `loading="lazy"` + `decoding="async"`
      below the fold. Largest real-world saving left.
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
