# Technical changelog

Content and SEO changes are in my-seo annotations for the `sz-games.github.io` property. Only technical changes are here.

- 2024-11-10: repo created and first games added (GitHub Pages, user site).
- 2026-03-26: ads.txt managed by Setupad.
- 2026-07-18: Adsterra removed.
- 2026-07-30 to 2026-08-21: ads.txt extended with ad supply chain and Aniview records. VDO.AI player added (08-12) and removed (09-03).
- 2026-09-05: service worker removed (kill-switch file kept); invalid scheme-prefixed CNAME removed, so the site serves only on sz-games.github.io; covers made local (no more GitHub blob image links); back-button trap in the game page removed; new header, search and filter layout.
- 2026-09-30: unused Font Awesome kit and dead assets removed.
- 2026-10-01 (FL-88): robots.txt added, sitemap regenerated, Bad Ice Cream cross-links removed so it does not duplicate sz-games.com.
- 2026-10-02: canonical tags, noindex on embeds, Bad Ice Cream 1 and 2 served from this site's own Flash copies (FL-93, FL-114).
- 2026-10-04: per-game title, description and canonical in the game viewer (FL-261).
- 2026-10-05: Infinite Road game added at `/games/infinite-road/` (FL-319).
- 2026-10-08: CI check for broken links, sitemap and canonicals (FL-671).
- 2026-10-12: stronger home result for the brand search "sz games" (FL-986). Merged to `main` as PR #6.
- 2026-10-16: project audit (FL-1141), docs added.
- 2026-10-24 (FL-1453): sitemap built from games.js by `scripts/build_sitemap.py` (298 URLs, utility pages removed); one Wordle entry (Games5); Wordle added to the home "Popular now" rail.
- 2026-10-24 (FL-1453): the sitemap build probes each game target and leaves it out when the target does not answer 200 (5 games left out, 293 URLs). `scripts/sitemap-allow.txt` overrides the check for a live game that blocks it. Tests for the build script run in CI.
