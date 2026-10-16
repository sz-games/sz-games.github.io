// URL checks for values taken from the query string (SEC-2026-10).
// Load with a plain <script src="/safe-url.js"> before any script that uses it.

// For a game frame: https URLs only (same-origin paths resolve to https; plain
// http is let through only for a same-origin local dev server).
// javascript:, data:, blob: and anything unparseable give about:blank.
function safeGameUrl(value) {
  if (!value) return 'about:blank'
  try {
    var u = new URL(value, window.location.href)
    if (u.protocol === 'https:' || (u.protocol === 'http:' && u.origin === window.location.origin)) return u.href
  } catch (e) {}
  return 'about:blank'
}

// For a top-level redirect: same-origin URLs only, otherwise the home page.
function safeRedirectUrl(value) {
  if (!value) return '/'
  try {
    var u = new URL(value, window.location.href)
    if (/^https?:$/.test(u.protocol) && u.origin === window.location.origin) return u.href
  } catch (e) {}
  return '/'
}
