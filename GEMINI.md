# Sz Games - Project Context

## Overview
**Sz Games** is a static web-based game aggregation platform designed primarily for school environments. It focuses on providing "unblocked" access to web games using techniques like tab cloaking and `about:blank` embedding. The site features a library of over 250 games, including retro titles, emulators, and popular web games.

## Architecture
The project is a **static website** hosted on GitHub Pages. It does not use a backend database or server-side rendering language. It relies on:
* **Frontend:** HTML5, CSS3, and Vanilla JavaScript.
* **Homepage catalogue:** The canonical game cards (their names, descriptions/labels, and links) are present directly in `index.html` inside `#games`. This is intentional: crawlable game content must remain in the initial HTML and must not depend on scrolling or client-side rendering.
* **Legacy catalogue code:** `games.js` and `script.js` are used by legacy pages, but are not loaded by the homepage. Do not treat them as the homepage source of truth without introducing a static build step that emits equivalent HTML into `index.html`.

## Key Files & Directories

### Core
* **`index.html`**: Main entry point. Contains navigation, ads configuration, and the complete static `#games` catalogue.
* **`scripts.js`**: Homepage menu, search, category-filtering, scroll, and image-loading behavior. It must only enhance the static catalogue, not replace it.
* **`games.js` / `script.js`**: Legacy data and rendering code loaded by `beforeop.html`; not loaded by the homepage.
* **`styles.css`**: Homepage styling. `style.css` contains legacy/alternate styles.

### Content
*   **`games/`**: Directory containing HTML files for individual games or iframed content.
*   **`cover/`**: Stores game thumbnails and cover images.
*   **`_config.yml`**: Minimal Jekyll configuration (primarily for GitHub Pages settings).

## Development Workflow

### 1. Running Locally
Since this is a static site, you can serve it using any simple HTTP server.
*   **Python:** `python3 -m http.server 8000`
*   **Node.js:** `npx http-server .`
*   **VS Code:** Use the "Live Server" extension.

### 2. Adding a New Game
Add homepage games as complete, semantic cards in **`index.html`** inside `#games`:
1. Include a crawlable `<a href="...">`, visible game name, category attribute, and an `<img>` with an accurate `alt` value.
2. Use a local cover under `cover/` where possible.
3. Keep the card in the initial HTML. Do not make its title, link, or descriptive text dependent on search, scrolling, or JavaScript rendering.
4. If the catalogue is ever split or changed to infinite scroll, publish crawlable static paginated/category URLs with ordinary links; a scroll or “Load more” control must not be the only way to discover games.

`games.js` remains legacy data for pages that load it; it is not the homepage catalogue source of truth.

### 3. Modifying Logic
*   **UI Changes:** Edit `index.html` for structure or `script.js` for dynamic behavior.
*   **Styling:** Edit `styles.css`.
*   **Note:** The project uses direct DOM manipulation (`document.getElementById`, `createElement`). There is no build step (Webpack/Vite) or framework (React/Vue).

## Project Features
*   **Tab Cloaking:** Disguises the tab to look like Google or other educational sites.
*   **About:Blank Embedding:** Opens games in an `about:blank` page to bypass some extension-based blockers.
*   **Panic Button:** A feature to quickly hide the game.
*   **PWA Support:** `service-worker.js` and `manifest.json` indicate Progressive Web App capabilities.

## Conventions
*   **Variable Naming:** CamelCase is generally used (e.g., `gamesData`, `renderGames`).
*   **Formatting:** Standard JS formatting.
*   **Dependencies:** No `package.json` means no NPM dependencies. All libraries (like FontAwesome, Google Ads) are loaded via CDN in `index.html`.
