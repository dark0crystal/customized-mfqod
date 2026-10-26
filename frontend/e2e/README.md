# MFQOD e2e, visual and offline tests

This is a standalone package. It has its own `package.json`, it is not part of the app build, and it only talks to the
app through URLs and the DOM, so the same suite runs against the original Next.js app and the Vite + React Router
build.

## Setup

```bash
cd frontend/e2e
npm install
npx playwright install chromium   # only if the browser isn't already in ~/Library/Caches/ms-playwright
```

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `BASE_URL` | `http://127.0.0.1:3100` | App under test (Next baseline, `vite dev`, `vite preview`, nginx, ...) |
| `API_URL` | `http://127.0.0.1:8000` | FastAPI backend (used for API login and for test-data cleanup) |
| `QA_CREDENTIALS` | `e2e/.auth/qa-credentials.json` | JSON `{email,password,username,user_id}` for a **super_admin** test user. Never commit it. If it's missing, every logged-in test is **skipped** |
| `ALLOWED_HOSTS` | (none) | Extra `host:port` values the offline test should treat as internal, comma separated |
| `OFFLINE_ALL` | (unset) | `1` makes the offline test visit every route (not just the representative set) |
| `AUDIT_DATE_TO` | `2026-10-01T00:00:00Z` | Capture only: audit-log rows are pinned to entries before this instant |
| `E2E_ITEM_ID`, `E2E_CLAIM_ID`, `E2E_MISSING_ITEM_ID`, `E2E_USER_ID` | dev-DB ids | Ids for dynamic routes (see `routes.ts`) |

The backend must allow CORS from the app origin.

## Functional tests

```bash
BASE_URL=http://127.0.0.1:4180 QA_CREDENTIALS=/path/qa-credentials.json npx playwright test
npx playwright test tests/auth.spec.ts           # a single spec
```

| Spec | Covers |
|---|---|
| `auth.spec.ts` | Anonymous `/dashboard`, `/search` and `/unauthorized` redirect to login (with `returnUrl`). `/` picks the locale from Accept-Language (default `ar`). Form login with `returnUrl` (baseline bug: lands on `/ar/ar/dashboard`, a 404) and without (lands on `/{locale}`). Wrong password. Logout |
| `i18n.spec.ts` | The language switch keeps the path and flips `<html lang/dir>` between rtl and ltr |
| `public.spec.ts` | Every public page renders without page errors. Home. Branches map container and marker. Search, then open an item detail |
| `reports.spec.ts` | Report a found item and a missing item, with an image upload. Created rows are titled `E2E-…` and **permanently deleted via the API** in `afterAll` |
| `dashboard.spec.ts` | Every dashboard page renders for a super admin. Claims list and detail. Users list and detail. Permissions. Analytics charts and PDF download |
| `notfound.spec.ts` | 404 for an unknown route and an unknown locale |
| `offline.spec.ts` | **Air-gap check**: zero requests to any host other than the app and the backend, including logged-in pages and the Export PDF of analytics and item detail. Body font is Alexandria and loaded. Fonts come from the app origin. Set `EXTERNAL_REPORT=/tmp/x.json` to dump what was found |

## Visual regression

```bash
# 1. capture (route x locale ar/en x viewport desktop 1440x900 / mobile 390x844)
BASE_URL=http://127.0.0.1:3100 OUT_DIR=/tmp/shots/baseline QA_CREDENTIALS=... npx tsx scripts/capture.ts
BASE_URL=http://127.0.0.1:4180 OUT_DIR=/tmp/shots/candidate QA_CREDENTIALS=... npx tsx scripts/capture.ts
#    ONLY=home,guides limits the capture to those route names

# 2. compare (pixelmatch). Writes OUT/report.json and a diff PNG for every changed screenshot
A_DIR=/tmp/shots/baseline B_DIR=/tmp/shots/candidate OUT=/tmp/shots/diff FAIL_PCT=0.1 npx tsx scripts/compare.ts
```

How the capture keeps screenshots stable:
- A fixed clock (`FIXED_NOW`) and a seeded `Math.random`.
- Animations and transitions are disabled, and reduced motion is on.
- It waits for network idle, `document.fonts.ready` and image completion, and scrolls once through the page.
- The home splash screen (2.5 s timer) is waited out.
- The dashboard shell scrolls inside `<main>`, so the viewport is grown until no inner scroll container overflows
  (`expandedTo` in the manifest); otherwise only the first screen would be captured.
- The audit-log list request gets `date_to=$AUDIT_DATE_TO`, so rows created later (e.g. by the report tests) don't
  change the screenshot.
- Off-screen `loading="lazy"` images (closed mobile drawer) are not waited for.
- Masked regions (magenta) come from `GLOBAL_MASKS` plus the per-route `masks` in `routes.ts`. The Leaflet map is
  masked because its tiles come from the network.

Protected pages are captured with the session cookies the app itself sets (`token`, `refresh_token`, `user`).
