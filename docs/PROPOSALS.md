# Proposals

Nothing here is started. "Stack change" is not proposed: a static site on GitHub Pages costs nothing, has no runtime and no traffic or error problem to solve.

| # | Item | Gain | Effort | Risk |
|---|---|---|---|---|
| 1 | Decide on the open Google API key alert (Chat.html, see AUDIT-2026-10.md): restrict the key in Google Cloud to the site's referrers, or remove Chat.html | Clears the GitHub alert, stops abuse of the quota | 15 minutes, needs rus | Low |
| 2 | Review PR #3 (README grammar, from 2025) and close it | Clean PR list | 5 minutes | None |
| 3 | Bump `actions/checkout` v4 to v7 in `site-check.yml` | Latest action, no Node deprecation warnings | 1 line | Low (CI only) |
| 4 | Delete `service-worker.js` after a few more months | One dead file less | 1 line | Visitors with the old worker keep it until the next visit |
| 5 | Move the big `.swf` and `.unityweb` files out of git (or to R2) if the repo nears the 1 GB Pages limit | Smaller repo and faster clones | Medium | Medium: game paths change |
| 6 | Add more game pages to `sitemap.xml` (it lists 26 URLs) | More pages that Google can find | Small script | Low; thin pages may not index |
| 7 | Add Plausible to pages that lack it (13 of 27 root pages lack it) | Complete stats | Small | None |
| 8 | Fix the 13 known-broken links in `scripts/link-baseline.txt` | CI baseline shrinks | Small | None |
