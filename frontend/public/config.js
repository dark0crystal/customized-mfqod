// Runtime configuration for the MFQOD frontend.
// Loaded by index.html BEFORE the app bundle. In Docker this file is regenerated
// from environment variables at container start (see docker-entrypoint), so the
// same built image can point at any backend without a rebuild.
// This copy is used by `npm run dev` / `npm run preview`.
window.__APP_CONFIG__ = {
  API_URL: 'http://127.0.0.1:8000',
  // MAP_TILES_URL: '/map/oman.pmtiles',
  // MAP_TILES_TYPE: 'pmtiles', // 'pmtiles' | 'xyz' | 'none'
  // MAP_ATTRIBUTION: '© OpenStreetMap contributors · Protomaps',
  SHOW_EXTERNAL_MAP_LINKS: true,
};
