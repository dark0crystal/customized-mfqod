# Frontend Migration Plan: Next.js → Vite + React Router (Offline-Ready)

**Branch:** `feat/react-router-migration` (from `dev-v5`)
**Goals**
1. Replace Next.js 16 with **Vite + React Router v7** (static SPA, no Node server at runtime).
2. The site must work on an **air-gapped internal network**: zero requests to the internet — fonts, icons, images, map assets all served locally.
3. **Pixel-identical design**: same layout, colors, fonts, RTL/LTR behaviour, Arabic/English content.

---

## 1. Current state (audit, 2026-10-26)

| Area | Today | Impact |
|---|---|---|
| Size | ~29k lines, ~90 TS/TSX files, 80 already `'use client'` | Migration is mostly mechanical |
| Routing | `app/[locale]/(main)`, `(protected)/dashboard`, `unauthorized` — ~35 routes, dynamic segments `[id]`, `[itemId]`, `[claimId]`, `[userId]` | Rebuild as React Router route tree under `/:locale` |
| Server components | 8 files (root + 2 layouts, home, guides, how-mfqod-works, privacy-terms, help, unauthorized) using `getTranslations`, `getMessages`, `metadata`, `notFound` | Convert to client components |
| Middleware | `src/proxy.ts` — locale redirect + JWT-cookie check for `/dashboard`, `/search` | Becomes a `RequireAuth` route guard + `/` → `/ar` redirect |
| i18n | `next-intl` (72 imports), messages in `messages/{ar,en}.json`, EN fallback deep-merge in `i18n/request.ts` | Swap to **`use-intl`** (same `useTranslations` API — call sites unchanged) |
| Navigation | `next/navigation` (22 imports), `@/i18n/navigation` (locale-aware Link/useRouter), `next/link` (6) | Compat shims with **identical exported names/semantics** |
| Images | `next/image` (20 files), already `unoptimized: true` | Replace with `<img>` — no visual change |
| Fonts | `next/font/local` Alexandria 100–900; Lalezar used in PDF export (analytics, item detail). **`public/fonts/` is missing from the repo** | Commit woff2 files, plain `@font-face` |
| Icons | `lucide-react`, `react-icons` (npm, bundled) | Already offline — verify only |
| Map | `BranchMap.tsx`: marker PNGs from **cdnjs**, tiles from **tile.openstreetmap.org** | Must be fixed (see §4) |
| Other external | `BranchCard.tsx` Google Maps link, `Footer.tsx` link to `mrdas.mfqod.com` | Links only (no fetch); make Google Maps link configurable |
| Env | `process.env.NEXT_PUBLIC_HOST_NAME` inlined in ~30 places | Centralize in `src/config.ts`, read at **runtime** |
| Unused | `src/lib/server/*` (only `unauthorized/page.tsx` uses it), `next.svg`, `vercel.svg` | Delete |
| Deploy | Next standalone Node server on :3000 | nginx serving static `dist/` on :3000 |

---

## 2. Target architecture

```
frontend/
  index.html                 # <html lang/dir set at runtime>, no external links
  vite.config.ts             # @ alias → src, React plugin
  public/
    config.js                # window.__APP_CONFIG__ = { API_URL, ... } (overwritten by container at start)
    fonts/alexandria-{100..900}.woff2, lalezar-400.woff2
    map/ (marker icons, optional offline tiles)
  src/
    main.tsx                 # createBrowserRouter + RouterProvider
    routes.tsx               # route tree (lazy-loaded pages)
    config.ts                # API_URL etc. from window.__APP_CONFIG__ / import.meta.env
    styles/fonts.css         # @font-face declarations
    i18n/
      routing.ts             # locales ['en','ar'], default 'ar' (unchanged values)
      IntlProvider.tsx       # use-intl provider + EN fallback merge + <html dir/lang> sync
      navigation.ts          # SAME exports as today: Link, redirect, usePathname, useRouter, getPathname
    lib/next-compat.ts       # useRouter/usePathname/useSearchParams/useParams with next/navigation semantics
    layouts/ RootLayout, MainLayout, ProtectedLayout, DashboardLayout
    pages/ ...               # moved from app/[locale]/..., file names kept recognisable
```

**Key decisions**
- **Vite + React Router v7 in data/library mode** (`createBrowserRouter`). No SSR → output is plain static files, ideal for an internal nginx.
- **`use-intl`** replaces `next-intl`. `useTranslations`, `useLocale`, `useFormatter` keep working unchanged.
- **Compat shims keep semantics exactly**:
  - `@/i18n/navigation` `usePathname()` returns the path **without** locale; `Link`/`useRouter().push()` **add** the locale prefix.
  - `next/navigation` `usePathname()` returns the path **with** locale. Files importing from `next/navigation` get rewritten to `@/lib/next-compat`, which preserves this.
  - `useRouter()` provides `push`, `replace`, `back`, `forward`, `refresh` (refresh = revalidate/re-run effects).
- **Page metadata** → React 19 `<title>` in components (hoisted to `<head>` automatically).
- **CSS**: each layout keeps importing its own `globals.css` (main vs dashboard) in its lazy route module, so the stylesheet cascade matches Next.
- **Auth guard**: `RequireAuth` replicates `proxy.ts` exactly (cookie `token`/`jwt`, expiry check, `returnUrl`, clear stale cookies). Note: this was never real security — the backend enforces auth and permissions on every API call. That doesn't change.
- **Runtime config**: `API_URL` is read from `/config.js`, which the container generates from env vars at start-up. **One built image works on any internal server without a rebuild.**
- **CSP header** in nginx: `default-src 'self'; connect-src 'self' <API_URL>; img-src 'self' data: blob: <API_URL>`. The browser then *enforces* that nothing loads from the internet.

---

## 3. Agents & work breakdown

Agents in the same phase run in parallel. Each agent **owns a disjoint set of files**. Shared files (`package.json`, `vite.config.ts`, `routes.tsx`, `i18n/*`, `lib/next-compat.ts`, `config.ts`) are owned by Agent 3. Other agents ask the PM for changes to those files and don't edit them directly.

### Agent 1 — Project Manager (throughout)
- Creates the branch and keeps a status checklist at the bottom of this file.
- Freezes the **compat-layer contract** (exported names and behaviour of the shims) before Phase 2 starts.
- Reviews each agent's diff against the rules in §5 and rejects anything that changes visuals or behaviour.
- Routes QA bug reports to the owning agent and runs the fix loop until QA is green.
- Final integration: removes Next.js dependencies, updates `README.md`, `DOCKER.md`, `docs/installation-production.md`, and signs off.

### Agent 2 — QA / Testing (Phase 0 baseline + Phase 3 verification)
- **Phase 0 (before any code change)**: add Playwright (dev dependency, browsers installed locally). Against the **current Next app** with the backend running:
  - Capture baseline screenshots of every route × `ar`/`en` × desktop (1440) / mobile (390), logged out and logged in as admin.
  - Write framework-agnostic e2e smoke tests (URLs + DOM only): login/logout, returnUrl redirect, language switch with RTL↔LTR, search + item detail, report found/missing item (with image upload), claims flow, manage users, permissions, analytics + PDF export, branch map renders.
- **Phase 3**: run `tsc --noEmit`, `eslint`, `vite build`, the full e2e suite, and visual diffs against the baseline (threshold ≈0.1%). Then run the **offline test**: Playwright blocks every request whose host isn't the app or backend, and the suite fails on any blocked request. Also verify fonts load from `/fonts/*` (via `document.fonts` check) and that marker icons and tiles are served locally.
- Reports failures to the PM with route, screenshot diff, and console errors.

### Agent 3 — Platform / Foundation (Phase 1, blocking Phase 2)
- Scaffold Vite, React plugin, `@` alias, `index.html`, TS config, ESLint (drop `eslint-config-next`), and npm scripts (`dev`, `build`, `preview`, `lint`, `typecheck`).
- Dependencies: add `react-router`, `use-intl`, `vite`, `@vitejs/plugin-react`, and `@tailwindcss/vite` (or keep the PostCSS setup). Remove `next`, `next-intl`, `eslint-config-next`.
- Router tree with lazy routes mirroring every current URL exactly, `/` → `/ar`, unknown locale → 404, `*` → not-found.
- Layouts: Root (html lang/dir, splash tracker, leaflet CSS), Main, Protected, Dashboard, ported 1:1.
- i18n provider with the same EN-fallback deep merge. Messages are bundled per locale (dynamic import).
- `@/i18n/navigation` and `@/lib/next-compat` shims, `RequireAuth`, `src/config.ts`, and `<title>` handling.
- Delete `src/lib/server/*`, `proxy.ts`, `next.config.ts`, and `next-env.d.ts`.
- **Done when** `npm run dev` boots, home page renders in ar and en, and an auth redirect works.

### Agent 4 — Offline Assets & Deployment (Phase 1, parallel with Agent 3)
- **Fonts**: commit the **complete** fonts from the official `google/fonts` repo (OFL) to `public/fonts/`: Alexandria variable woff2 (weights 100–900, Arabic + Latin in one file) and Lalezar 400, plus their OFL licence. Write `styles/fonts.css` (`font-display: swap`, same fallback stack `system-ui, arial, sans-serif`). Replace the `next/font` class with `font-family: 'Alexandria', …` on `html, body`. Note: the old `download-fonts.sh` was broken. Google serves per-script subsets, and the script grabbed only the first one (Arabic), so English text had no Alexandria glyphs. Remove or replace the script.
- **Icons**: confirm `lucide-react` and `react-icons` are bundled, with no runtime fetch.
- **Leaflet**: import marker PNGs from `leaflet/dist/images/*` (bundled by Vite) instead of cdnjs.
- **Map tiles**: implement the option chosen in §4.
- **External link audit**: put the Google Maps link behind a `config.js` flag (hidden when offline). Grep the final `dist/` for `https?://` and allow-list only plain hyperlinks.
- **Deployment**: new `frontend/Dockerfile` (node build stage → `nginx:alpine`), `nginx.conf` (SPA fallback `try_files $uri /index.html`, gzip, long cache for hashed assets, CSP, security headers), entrypoint that writes `config.js` from env. Update `docker-compose*.yml` (keep port 3000, health check) and `Makefile`.
- **Air-gap guide**: build on a connected machine → `docker save` → transfer → `docker load`. Document in `docs/installation-production.md`.

### Agent 5 — Public site & shared components (Phase 2)
`app/[locale]/(main)/**` (home, search, search/[id], guides, how-mfqod-works, branches-info, legal, auth/login, register, forgot-password, reset-password), `app/[locale]/unauthorized`, `src/components/**`, `src/hooks/**`, `src/utils/**`, `src/services/**`, `PermissionsContext.tsx`.

### Agent 6 — Dashboard A: items & claims (Phase 2)
`dashboard/items/**`, `dashboard/missing-items/**`, `dashboard/claims/**`, `dashboard/report-found-item`, `dashboard/report-missing-item`, `dashboard/transfer-requests`, `dashboard/Claims.tsx`, `dashboard/UserReports.tsx`. Includes the largest file, `items/[itemId]/page.tsx` (2.2k lines, PDF export with Lalezar).

### Agent 7 — Dashboard B: admin & shell (Phase 2)
`dashboard/DashboardShell.tsx`, `SideNavbar.tsx`, `UserInfo.tsx`, `dashboard/page.tsx`, `analytics`, `audit-logs`, `branch`, `item-types`, `manage-users/**`, `permissions`, `help/**`.

**Per-file recipe for Agents 5–7**
1. `next/image` → `<img>`. Keep every `className`, `width`, `height`, and `alt`. `fill` → `absolute inset-0 w-full h-full` plus the same `object-*`.
2. `next/link` → `Link` from `@/i18n/navigation` if the href has no locale, or from `react-router` if it already includes the locale.
3. `next/navigation` → `@/lib/next-compat`. `notFound()` → `<NotFound/>`. `redirect()` → `<Navigate/>` or `navigate()`.
4. `next-intl` → `use-intl`. `getTranslations` (server) → `useTranslations` (component becomes client).
5. Page `params` props (`Promise<{id}>`) → `useParams()`.
6. `process.env.NEXT_PUBLIC_HOST_NAME || '…'` → `API_URL` from `@/config`.
7. Remove `'use client'` directives (harmless but noise).
8. **Do not touch** Tailwind classes, colors, markup structure, or translation keys.

### Phases
| Phase | Agents | Exit criteria |
|---|---|---|
| 0 | PM, QA baseline | Baseline screenshots and e2e suite green on the Next app |
| 1 | Platform, Offline Assets | Vite app boots; fonts/map/assets local; Docker image builds |
| 2 | Agents 5, 6, 7 in parallel | Zero `next`/`next-intl` imports; `tsc` and `vite build` pass |
| 3 | QA → owners fix loop, PM | e2e green, visual diff within threshold, offline test 0 external requests, PM sign-off |

---

## 4. Decision — offline map tiles: **Option A (self-hosted tiles) chosen 2026-10-26**

`BranchMap` currently loads tiles from the OpenStreetMap servers, so on an offline network the map is **grey**. Options:

- **A. Self-hosted tiles (chosen)**: OpenStreetMap's tile usage policy forbids bulk-downloading `tile.openstreetmap.org` tiles for offline use. Instead, extract **Oman from the Protomaps OpenStreetMap basemap** (`pmtiles extract`, one `.pmtiles` file, size capped at ~400 MB). Serve it from nginx at `/map/` from a mounted volume (not committed to git), and render it inside the existing Leaflet map with `protomaps-leaflet`. A script `scripts/download-map-tiles.sh` fetches it on a connected machine. `config.js` can switch to an org XYZ tile server later. The map style is the Protomaps "light" style, close to the OSM look but not identical.
- **B. Configurable URL + graceful fallback**: tile URL in `config.js`. If tiles fail to load, hide the map and show the branch list and addresses only.
- **C. Remove the interactive map**: replace it with a static image per branch.

---

## 5. Rules for every agent
- No visual changes. Any change to Tailwind classes, colors, spacing, or translation keys must be justified to the PM.
- No new runtime dependency that fetches from a CDN. No `<link>` or `<script>` tags to external hosts.
- Keep URLs identical (`/ar/dashboard/items/123` etc.) so bookmarks and backend emails (password reset links) keep working.
- Edit only the files you own. Request shared-file changes through the PM.
- Each agent finishes with `npx tsc --noEmit` clean for its files and a short change summary.

---

## 6. Status checklist (maintained by PM)
- [x] Phase 0 — branch `feat/react-router-migration` created
- [x] Phase 0 — Playwright baseline captured on the frozen Next app (port 3100): e2e suite plus 120 screenshots (`visual/baseline-1`, logged out and logged in as the QA super-admin `qa.migration@mfqod.local`).
- [x] Phase 1 — Platform scaffold. PM contract gate passed on 2026-10-26:
  - Shims were reviewed against the next-intl 4.8.2, Next 16.1.5 `get-img-props` and `proxy.ts` sources.
  - The route table covers all 30 baseline pages, and `src/app` is gone.
  - 27/27 Playwright gate checks pass on both Vite :5180 and the baseline :3100.
  - One fix: NotFound no longer sets a `<title>`, matching the baseline 404 title.
  - Contract amended with §5 titles and §6 items 13–15.
- [x] Phase 1 — Offline assets and Docker:
  - Fonts are local: the complete Alexandria variable font plus Lalezar, with their OFL licences.
  - Marker icons are bundled, and the map uses Protomaps `.pmtiles` tiles.
  - Nginx and the Dockerfile are written. The entrypoint writes `config.js` and sets the CSP.
  - The compose files, Makefile and docs are updated.
  - Docker acceptance check passed in QA round 2 (image on :4185: build, deep links, `/healthz`, generated `config.js`, CSP and security headers, pmtiles 206, 0 CSP violations, 0 external requests). Round-1 defect D1 (`/dsalogo.png` 403) is fixed.
  - **Open:** `scripts/download-map-tiles.sh` has not run end to end; only its syntax is checked.
- [x] Phase 2 — Public site & components. Lalezar now uses the `font-lalezar` class, with a 0 px diff.
- [x] Phase 2 — Dashboard A. Verified with real data in QA round 2.
- [x] Phase 2 — Dashboard B. Verified logged in in QA round 2 (sidebar, badges, collapse, RTL/LTR, analytics PDF).
- [x] Integration (PM, 2026-10-26):
  - Removed the temporary `next`/`next-intl` bridge (`src/lib/legacy-next/` and the aliases and env plugin in `vite.config.ts`).
  - `npm install` changed nothing. The lockfile has no `next`, `next-intl` or `eslint-config-next`.
  - `npm run typecheck` is clean.
  - `npm run lint` gives 0 errors and 56 warnings. The Next baseline gave 10 errors and 61 warnings.
  - `npm run build` passes. It no longer copies the 165 MB `public/map/*.pmtiles` into `dist/` and hard-links it instead.
  - `MAP_ATTRIBUTION` now defaults to `© OpenStreetMap contributors · Protomaps`, and `protomaps-leaflet` is pre-bundled.
  - `frontend/.gitignore` and the root `.dockerignore` no longer have Next.js entries.
  - The URLs found in `dist/` are listed below. None is fetched at runtime.
  - Smoke test on `vite preview` with every non-app, non-backend request aborted: 15 routes in ar and en, 0 external requests, 0 failed requests and 0 console errors.
  - The frontend `README.md`, `env.example` and root `README.md` describe the new commands and runtime config.
- [x] Phase 3 — QA green (round 1: 1 defect, D1; round 2: 0 defects). Production build on :4180 and Docker image on :4185, logged in as the QA super-admin:
  - e2e 76 passed / 0 skipped / 0 failed;
  - visual regression 120/120 pixel-identical with the baseline (map tiles masked);
  - offline suite 4/4 and a 60-page logged-in crawl with non-local hosts blocked: 0 external requests (the baseline made 40: OSM tiles and cdnjs);
  - Dashboard-B checks 18/18 identical; analytics and item PDF exports valid and the same size as the baseline in both locales.
- [x] Docs updated, Next.js removed, PM sign-off (2026-10-26). Working tree checked: no build output, node_modules, screenshots or `.pmtiles` are untracked; all are git-ignored. Nothing is committed yet.

### Integration audit: URLs in the built `dist/` (none fetched at runtime)
- **Links (anchors only):**
  - `https://mrdas.mfqod.com/` (footer)
  - `https://www.google.com/maps?q=…` (branch card; hidden unless `SHOW_EXTERNAL_MAP_LINKS=true`)
  - Map attribution links: `https://leafletjs.com`, `https://protomaps.com`, `https://openstreetmap.org/copyright`
- **Library strings that are never fetched:**
  - Error-message links: `react.dev/errors`, `reactrouter.com`, `redux.js.org`, `redux-toolkit.js.org`, `bit.ly/3cXEKWf` (immer), and `nextjs.org/docs/…use-search-params` (an error string in `next-compat`)
  - A `date-fns` docs link
  - core-js licence links
  - `http://localhost` and `http://example.com`, used only as URL-parsing bases (react-router, protomaps-leaflet)
  - XML namespaces: `w3.org` and `http://jspdf.default.namespaceuri/`
  - The OFL licence URLs in `fonts/OFL-*.txt`
- **Dormant:** jsPDF has `https://cdnjs.cloudflare.com/ajax/libs/pdfobject/…`. jsPDF loads it only for `output('pdfobjectnewwindow')`, which the app never calls, and the nginx CSP would block it anyway.
- **Config defaults:** `http://localhost:8000` (`src/config.ts`) and `http://127.0.0.1:8000` (the dev `public/config.js`). The Dockerfile removes `dist/config.js`, and the entrypoint regenerates it.

---

## 7. Results

**What changed**
- `frontend/` is now a Vite + React Router v7 static SPA (`index.html`, `src/main.tsx`, `src/router.tsx`). Pages moved from `src/app/[locale]/…` to `src/routes/…`; every URL is unchanged (`/ar/…`, `/en/…`, dynamic ids).
- `next-intl` was replaced by `use-intl`, and `next/navigation`, `next/link` and `next/image` by small shims (`src/lib/next-compat.tsx`, `src/lib/Image.tsx`, `src/i18n/navigation.tsx`). The `proxy.ts` middleware became the `RequireAuth` route guard. The `NEXT_LOCALE` cookie name is kept so users keep their language.
- The backend URL is read at runtime from `/config.js` (`API_URL`, map settings), so one image works on any server. The container entrypoint writes `config.js` and the CSP header from env vars.
- Offline: Alexandria (variable, Arabic + Latin) and Lalezar are served from `/fonts`; Leaflet marker icons are bundled; the branch map draws a self-hosted Protomaps `oman.pmtiles` file (from `storage/map`, mounted at `/map/`). The nginx CSP only allows `'self'` plus the API origin.
- Docker: the frontend image is nginx serving `dist/` on port 3000 (about 83 MB) instead of a Next Node server. `make save-images` / `make load-images` cover air-gapped installs.

**How to run**
```bash
# Development (from frontend/)
npm ci
npm run dev                      # http://localhost:5180, API from public/config.js
npm run typecheck && npm run lint
npm run build && npm run preview # production build on http://localhost:4180

# Offline map tiles (once, on a machine with internet, from the repo root)
make map-tiles                   # -> storage/map/oman.pmtiles
ln -s ../../../storage/map/oman.pmtiles frontend/public/map/oman.pmtiles   # dev only

# Docker (from the repo root)
docker build -f frontend/Dockerfile -t mfqod-frontend:latest .
docker run -p 3000:3000 -e API_URL=http://<backend-host>:8000 \
  -v "$PWD/storage/map:/usr/share/nginx/html/map:ro" mfqod-frontend:latest
make save-images                 # images -> mfqod-images.tar.gz for the air-gapped server
make load-images                 # on the air-gapped server
```

**Known differences (not regressions)**
- The map base layer is the Protomaps "light" style instead of OpenStreetMap's tiles; it looks similar but not identical. Attribution reads `© OpenStreetMap contributors · Protomaps`.
- In the deployed Next app English text fell back to an Arial-based font because the old font download was Arabic-only. The new app ships the full Alexandria font, so English now renders in Alexandria. (The frozen baseline used for QA already had the full font, so the visual diff shows 0 px.)
- The Google Maps link on branch cards is hidden unless `SHOW_EXTERNAL_MAP_LINKS=true` (it cannot work offline).
- Brand and SplashScreen use the class `font-lalezar` instead of a generated `next/font` class (0 px difference).

**Open items**
| Item | Owner |
|---|---|
| Run `scripts/download-map-tiles.sh` (`make map-tiles`) end to end on a connected machine | Assets / ops |
| Delete the QA test account `qa.migration@mfqod.local` from the local database once no more testing is needed (it also has QA-created `login_attempts`, `user_sessions` and `audit_logs` rows) | Owner of the local DB (user approval) |
| Review and commit the branch; open the PR to `main` | User |
| Baseline issues left unchanged on purpose: missing English keys `dashboard.analytics.of`, `dashboard.analytics.itemsReturned`, `branches.allOrganizations`, `analytics.itemType`, `dashboard.userInfo.retry`; 56 lint warnings | Product / frontend team |
| Backend CORS must list the frontend origin on each server (`CORS_ORIGINS` in `backend/.env`) | Ops |

**QA reports:** `qa-report-round-2.md` (final, PASS) and the round-1 report in the session scratchpad (`/private/tmp/claude-501/-Users-madadtechteam-customized-mfqod/b51c0bcb-c729-4f3f-916b-5effd85cfadf/scratchpad/`). The e2e suite itself is in `frontend/e2e/` (see its README).
