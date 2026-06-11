/*
 * Runtime environment variables.
 * This file is processed by docker-entrypoint.sh via envsubst.
 * For local dev / GitHub Pages, copy to env.js and edit values directly.
 */
(function (window) {
  window.__env = window.__env || {};

  // Backend WebSocket URL (e.g. ws://localhost:8080 or wss://api.example.com)
  // Leave empty to auto-detect from window.location
  window.__env.backendWsUrl = '${BACKEND_WS_URL}';

  // Backend HTTP URL for REST calls (e.g. http://localhost:8080)
  window.__env.backendHttpUrl = '${BACKEND_HTTP_URL}';
})(this);
