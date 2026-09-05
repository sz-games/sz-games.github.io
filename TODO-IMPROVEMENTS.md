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

## Done (2026-09-05, round 3)
- [x] **`cover/` WebP conversion**: 324 images PNG/JPG → WebP q80
      (26.4 MB → 3.7 MB), refs updated across 19 files, zero dangling
      refs verified. 25 kept as-is (WebP bigger or pre-existing pair).
      `lol.jpeg`/`lol.webp` proven distinct images — left untouched.
- [x] **Unreferenced covers deleted** (incl. `loll.png` etc.)
- [x] **`styles.css` `!important` audit**: removed invalid `padding: none
      !important` ×3 (browsers ignore invalid `padding:none` — zero
      visual change) + dead duplicate `opacity: 0`. Remaining
      `!important`s are load-bearing (animations, feat-card dims,
      `.textover` vs inline-attr specificity) — documented, not removed.
- [x] **Video poster**: moot — no `<video>` tags site-wide, 23 MB file
      deleted in round 2.
- [x] **Dead pages / PWA**: keepers verified, orphan splash icons deleted.
- [x] **`games.js` imgSrc hosts**: left mixed (`blob…?raw=true` vs
      `raw.githubusercontent` vs local) — all resolve today; unifying
      risks breaking cached/hotlinked images for zero perf gain.

## Done (2026-09-05, round 4 — verified headless Chromium, 390px)
- [x] **True mobile fit**: page rendered 990px wide on phones. Traced to
      flex min-content blowout + absolute dropdown + img margins.
      scrollWidth 990 → 390, zero overflowers; desktop 1280 unchanged.
      Screenshots verified: hero, stacked search/filter, 2-col grid,
      scroll-snap featured row, in-flow dropdown.

## Done (2026-09-05, round 5 — back-button trap removal)
- [x] **`games/game.html`**: removed the `popstate` pushState loop (back button
      now works normally), the no-op head `beforeunload`, the dead
      iframe-element `beforeunload`, and the `slotRenderEnded` handler that
      forced `#game` hash (was polluting history on every ad render).
- [x] Replaced with a **single polite native leave-prompt** (`beforeunload` +
      `returnValue`) — skipped for intentional nav via Back/Home buttons and
      same-origin `<a>` links.
- [x] Icon-only arrow_back → visible labeled **Back button** (icon + text,
      hover state, `aria-label`).
- [x] Removed stray prod `console.log` (game URL). All 10 inline scripts
      syntax-verified via Node. Trap pattern confirmed absent from all other pages.

## Still open (needs human call)
- [ ] `games/` (276 MB) is game binaries (unity/wasm/swf) — out of scope
      for web-code optimization.

## Out of scope (other projects — do NOT touch from here)
- `agent-bridge-server.js` token hardening (bridge project)
- `/workspace/serve-tunnel.sh`, tunnel logs (workspace infra)
- `/workspace/tetris.html` (separate experiment)
