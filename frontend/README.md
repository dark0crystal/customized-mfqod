# MFQOD frontend

Static single-page app built with **Vite 7 + React 19 + React Router 7** (`createBrowserRouter`,
lazy-loaded routes) and **use-intl** for Arabic/English translations (`messages/{ar,en}.json`).
In production it is plain static files served by nginx. No Node.js server runs at runtime.

The app is built to run on an **air-gapped network**:

- Fonts are local: `public/fonts/` holds Alexandria (variable, Arabic + Latin) and Lalezar, plus their OFL licences, and `src/styles/fonts.css` declares them.
- Icons come from `lucide-react` and `react-icons`, which are bundled into the JS.
- Map marker images are bundled from `leaflet`. Map tiles come from a self-hosted Protomaps `.pmtiles` file under `/map/`.
- Nothing is loaded from a CDN, and nginx sends a Content-Security-Policy that allows only this server and the backend.

## Requirements

- Node.js 20+
- The backend running at `API_URL` (default `http://127.0.0.1:8000` for local development)

## Commands

```bash
npm install          # or `npm ci`
npm run dev          # dev server with hot reload: http://127.0.0.1:5180/ar
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run build        # production build -> dist/
npm run preview      # serve dist/ locally: http://127.0.0.1:4180/ar
```

To use another port, run `npx vite --port 5181`. `npm run dev -- --port …` does not work because the
script already sets `--port`. To reach the dev server from other machines, run `npx vite --host 0.0.0.0`.

## Configuration (runtime, no rebuild)

`index.html` loads **`/config.js`** before the app bundle. It sets `window.__APP_CONFIG__`:

| Key | Default | Meaning |
|---|---|---|
| `API_URL` | `http://localhost:8000` | Backend base URL **as seen by the browser** |
| `MAP_TILES_URL` | `/map/oman.pmtiles` | `.pmtiles` file, or an XYZ template `…/{z}/{x}/{y}.png` |
| `MAP_TILES_TYPE` | `pmtiles` | `pmtiles`, `xyz` or `none` (hides the tile layer) |
| `MAP_ATTRIBUTION` | `© OpenStreetMap contributors · Protomaps` | Map attribution text |
| `SHOW_EXTERNAL_MAP_LINKS` | `false` | Show the "View on map" (Google Maps) buttons. These need internet, so keep them off when air-gapped. |

- **Development and `npm run preview`:** edit `public/config.js`.
- **Docker:** the container writes `/config.js` from environment variables at start-up
  (`docker-entrypoint.sh`), so one image works against any backend. `NEXT_PUBLIC_HOST_NAME` is still
  accepted there as an alias for `API_URL`.
- **Build-time fallback:** `VITE_API_URL`, `VITE_MAP_TILES_URL`, … (from the environment or `.env.local`, see
  `env.example`) are used only for keys that `config.js` does not set.

All code reads these values through `src/config.ts` (`import { API_URL } from '@/config'`).

## Offline map tiles

The branch map (`src/components/BranchMap.tsx`) renders a Protomaps vector basemap from a single file.
To create it on a machine with internet access, run `scripts/download-map-tiles.sh` from the repository root.
The script writes `storage/map/oman.pmtiles`. Then either:

- **Docker:** mount `./storage/map` at `/usr/share/nginx/html/map` (docker-compose already does this), or
- **Local development:** link or copy the file to `public/map/oman.pmtiles` (git-ignored).

`npm run build` does not copy `*.pmtiles` into `dist/`. It hard-links the file when it can, so
`npm run preview` still shows the map. Without the file, the map shows the markers on a blank background.

## Project layout

```
index.html               # loads /config.js, then src/main.tsx
public/                  # served as-is: config.js, fonts/, images, favicon
src/main.tsx             # entry: fonts.css + RouterProvider
src/router.tsx           # route table (every URL of the former Next.js app, unchanged)
src/routes/              # RootLayout, main/ (public site), dashboard/, ProtectedLayout, NotFound
src/i18n/                # locales (ar default, en), IntlProvider (EN fallback merge), navigation helpers
src/lib/next-compat.tsx  # useRouter/usePathname/useSearchParams/useParams/Link with the old semantics
src/lib/Image.tsx        # <Image> that renders the same <img> as before
src/lib/RequireAuth.tsx  # locale redirect + /dashboard and /search login redirect (was middleware)
src/config.ts            # runtime configuration (see above)
src/styles/fonts.css     # @font-face for the local fonts
nginx/, Dockerfile       # production image (nginx, SPA fallback, CSP, caching)
e2e/                     # Playwright tests (separate package)
```

`docs/react-router-compat-contract.md` describes the shims and the route table in detail.

## Docker

Build from the **repository root**:

```bash
docker build -f frontend/Dockerfile -t mfqod-frontend:latest .
docker run -p 3000:3000 -e API_URL=http://<backend-host>:8000 \
  -v "$PWD/storage/map:/usr/share/nginx/html/map:ro" mfqod-frontend:latest
```

See `DOCKER.md` and `docs/installation-production.md`, which also covers air-gapped deployment
(`docker save` and `docker load`).
