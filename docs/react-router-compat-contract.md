# React Router compatibility contract (Platform → page agents)

**Status:** frozen by Platform on 2026-10-26. Paths are relative to `frontend/` unless noted.
**Binding for:** Public, Dashboard-A, Dashboard-B, Assets, QA, PM. Read with
`docs/react-router-migration-plan.md` (sections 2, 3, 5).

The app is now a Vite 7 + React Router 7 SPA (`createBrowserRouter`, lazy route modules) with
`use-intl` for translations. Most files port with **import-path changes only**.

---

## 1. Running it

```bash
cd frontend
npm install
npx vite --port 5181          # each agent uses its own port: 5181 Public, 5182 Dash-A, 5183 Dash-B, 5184 Assets
npm run dev                   # = vite --port 5180 (Platform/PM)
npm run typecheck             # tsc --noEmit -p .
npm run lint                  # eslint .
npm run build                 # vite build -> dist/   (no tsc in build)
npm run preview               # vite preview --port 4180 (QA)
```

Do **not** use `npm run dev -- --port 5181`: the script already passes `--port 5180`, so use
`npx vite --port <port>` directly. Start it in the background (`nohup npx vite --port 5181 > log 2>&1 &`)
and kill only your own process. The server binds `127.0.0.1` with `strictPort`.

Dev runtime config is `public/config.js` (`API_URL: 'http://127.0.0.1:8000'`, `SHOW_EXTERNAL_MAP_LINKS: true`).

### Temporary migration bridge (read this)

So that every agent can run the whole app while files are still being ported, `vite.config.ts`
contains a **temporary bridge** (deleted by the PM at integration):

| Unported code | Is resolved at runtime to |
|---|---|
| `import … from 'next-intl'` | `use-intl` (+ a pass-through `NextIntlClientProvider`) |
| `import … from 'next/navigation'` | `@/lib/next-compat` |
| `import Link from 'next/link'` | `Link` from `@/lib/next-compat` |
| `import Image from 'next/image'` | `@/lib/Image` |
| `import localFont from 'next/font/local'` | stub returning `{ className: '' }` |
| `process.env.NEXT_PUBLIC_HOST_NAME` (in `src/`) | `window.__APP_CONFIG__.API_URL` |

The bridge is **not** part of the contract. `tsc` reports every remaining `next*` import and every
`process` as an error, and ESLint (`no-restricted-imports`) reports every `next`/`next-intl` import
as an error. Your files are done only when they have **zero** `next`, `next-intl`, `next/*`,
`next-intl/*` imports and zero `process.env`. Server-only APIs (`next-intl/server`, `next/headers`,
`@/lib/server/*`) are **not** bridged; pages that use them crash until ported.

---

## 2. File moves (done by Platform with `git mv`)

| Before | After |
|---|---|
| `src/app/layout.tsx` | `src/routes/RootLayout.tsx` |
| `src/app/[locale]/(main)/**` | `src/routes/main/**` |
| `src/app/[locale]/(protected)/layout.tsx` | `src/routes/ProtectedLayout.tsx` |
| `src/app/[locale]/(protected)/dashboard/**` | `src/routes/dashboard/**` |
| `src/app/[locale]/unauthorized/page.tsx` | `src/routes/unauthorized/page.tsx` |
| `src/app/icon.png` | `public/icon.png` (favicon, linked from `index.html`) |
| `src/app/[locale]/(main)/favicon.ico` (unused by Next) | `public/favicon.ico` |

Dynamic-segment folder names (`[id]`, `[itemId]`, `[claimId]`, `[userId]`) are unchanged.
`git status` shows `guides/QA*.tsx` ↔ `help/QA*.tsx` as cross-renames only because the files are
byte-identical; each file is in its normal place.

Deleted: `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs` (→ `eslint.config.js`),
`tsconfig.tsbuildinfo`, `.next/`, `src/proxy.ts`, `src/i18n/request.ts`, `src/lib/server/**`,
`public/{next,vercel,file,globe,window}.svg` (unused).

New platform files: `index.html`, `vite.config.ts`, `tsconfig.node.json`, `eslint.config.js`,
`public/config.js`, `src/main.tsx`, `src/router.tsx`, `src/config.ts`, `src/vite-env.d.ts`,
`src/i18n/IntlProvider.tsx`, `src/i18n/locale.ts`, `src/i18n/navigation.tsx` (was `.ts`, same import path),
`src/lib/next-compat.tsx`, `src/lib/Image.tsx`, `src/lib/RequireAuth.tsx`, `src/lib/legacy-next/*` (temporary),
`src/routes/LocaleLayout.tsx`, `src/routes/NotFound.tsx`, `src/routes/RouteErrorBoundary.tsx`,
`src/styles/fonts.css` (stub, owned by Assets from now on).

---

## 3. Route table

Every URL is unchanged. `src/router.tsx` lazy-loads each module (its **default export** is the route component).

Layout chain for everything under `/:locale`:
`RootLayout` → `LocaleLayout` (locale check, `use-intl` provider, `<html lang dir>`) → error boundary → group layout → page.

| URL pattern | Module | Layout chain (below LocaleLayout) | Auth (RequireAuth) |
|---|---|---|---|
| `/` | — | redirect to `/<locale>` | — |
| `/:locale` | `routes/main/page.tsx` | MainLayout | — |
| `/:locale/auth/login` | `routes/main/auth/login/page.tsx` | MainLayout | — |
| `/:locale/auth/register` | `routes/main/auth/register/page.tsx` | MainLayout | — |
| `/:locale/auth/forgot-password` | `routes/main/auth/forgot-password/page.tsx` | MainLayout | — |
| `/:locale/auth/reset-password` | `routes/main/auth/reset-password/page.tsx` | MainLayout | — |
| `/:locale/branches-info` | `routes/main/branches-info/page.tsx` | MainLayout | — |
| `/:locale/guides` | `routes/main/guides/page.tsx` | MainLayout | — |
| `/:locale/how-mfqod-works` | `routes/main/how-mfqod-works/page.tsx` | MainLayout | — |
| `/:locale/legal/privacy-terms` | `routes/main/legal/privacy-terms/page.tsx` | MainLayout | — |
| `/:locale/search` | `routes/main/search/page.tsx` | MainLayout | JWT cookie |
| `/:locale/search/:id` | `routes/main/search/[id]/page.tsx` | MainLayout | JWT cookie |
| `/:locale/dashboard` | `routes/dashboard/page.tsx` | ProtectedLayout → DashboardLayout | JWT cookie |
| `/:locale/dashboard/analytics` | `routes/dashboard/analytics/page.tsx` | ProtectedLayout → DashboardLayout | JWT cookie |
| `/:locale/dashboard/audit-logs` | `routes/dashboard/audit-logs/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/branch` | `routes/dashboard/branch/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/claims` | `routes/dashboard/claims/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/claims/:claimId` | `routes/dashboard/claims/[claimId]/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/help` | `routes/dashboard/help/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/item-types` | `routes/dashboard/item-types/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/items` | `routes/dashboard/items/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/items/:itemId` | `routes/dashboard/items/[itemId]/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/manage-users` | `routes/dashboard/manage-users/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/manage-users/:userId` | `routes/dashboard/manage-users/[userId]/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/missing-items` | `routes/dashboard/missing-items/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/missing-items/:id` | `routes/dashboard/missing-items/[id]/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/permissions` | `routes/dashboard/permissions/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/report-found-item` | `routes/dashboard/report-found-item/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/report-missing-item` | `routes/dashboard/report-missing-item/page.tsx` | ″ | JWT cookie |
| `/:locale/dashboard/transfer-requests` | `routes/dashboard/transfer-requests/page.tsx` | ″ | JWT cookie |
| `/:locale/unauthorized` | `routes/unauthorized/page.tsx` | (none, like before) | — |
| `/:locale/*` (anything else) | `routes/NotFound.tsx` | (none) | — |

Layouts:

- **RootLayout** (`routes/RootLayout.tsx`, eager): `leaflet/dist/leaflet.css`, `<ScrollRestoration/>`,
  `<SplashScreenTracker/>`, default `<title>مفقود | MFQOD</title>`, `<RequireAuth>` around the outlet.
- **LocaleLayout** (`routes/LocaleLayout.tsx`): unknown locale → `<NotFound/>`; `<AppIntlProvider locale>`.
- **MainLayout** (`routes/main/layout.tsx`): `./globals.css`, `<title>مفقود | MFQOD</title>`, radial
  background `div`, `<NavBar/>`, outlet. Same DOM as before.
- **ProtectedLayout** (`routes/ProtectedLayout.tsx`): unchanged logic (spinner, `tokenManager` check,
  `PermissionsProvider`).
- **DashboardLayout** (`routes/dashboard/layout.tsx`): `./globals.css`, `<title>Admin Dashboard</title>`,
  `PermissionsProvider`, `DashboardShell initialDirection` (DashboardShell is Dashboard-B's file).

### Redirect behaviour (`src/lib/RequireAuth.tsx`, replaces `src/proxy.ts` + next-intl middleware)

Mounted once in RootLayout; runs on every location change before any page renders.

1. Trailing slash removed: `/ar/` → `/ar` (Next did a 308).
2. Auth, exactly like `proxy.ts`: path (with or without locale) starting `/dashboard` or `/search`
   needs cookie `token` (else `jwt`) whose JWT payload `exp` is in the future (decoded with `atob`, as
   before). Otherwise cookies `token`, `jwt`, `refresh_token`, `user` are cleared and the browser goes
   (replace) to `/<locale>/auth/login?returnUrl=<pathname>`. `<locale>` is the URL's `en`/`ar`, else `ar`.
   The query string is dropped. Examples (identical to the baseline):
   `/ar/dashboard` → `/ar/auth/login?returnUrl=%2Far%2Fdashboard`,
   `/en/search/5?q=1` → `/en/auth/login?returnUrl=%2Fen%2Fsearch%2F5`,
   `/dashboard` → `/ar/auth/login?returnUrl=%2Fdashboard`.
   **This was never real security** (the JWT is not verified). The backend enforces auth and
   permissions on every API call, and that has not changed.
3. Locale prefix (next-intl `localePrefix: 'always'`): a path whose first segment is not exactly `en`/`ar`
   is redirected to `/<locale><path><search><hash>`. Locale = `NEXT_LOCALE` cookie → `navigator.languages`
   (the Accept-Language equivalent) → `ar`. So `/` → `/ar`, `/dashboard/items` → `/ar/dashboard/items`,
   `/fr` → `/ar/fr` (→ 404, same as the baseline), `/AR/search` → `/ar/search`.
4. Paths skipped by the old matcher (`/api…`, `/_next…`, anything containing a `.`) are not redirected.
5. `NEXT_LOCALE` cookie sync like the middleware: if the cookie exists and differs from the URL locale it
   is updated; if absent it is set only when the browser language would pick a different locale.

---

## 4. Shim APIs

### 4.1 `@/lib/next-compat` — replaces `next/navigation` and `next/link`

```ts
import { useRouter, usePathname, useSearchParams, useParams, notFound, redirect, Link } from '@/lib/next-compat';
```

| Export | Semantics (same as Next 16) |
|---|---|
| `useRouter(): { push(href, {scroll?}), replace(href, {scroll?}), back(), forward(), refresh(), prefetch(href) }` | Stable object (safe in effect deps). `href` is used **as-is**, without a locale prefix. It resolves like the browser (relative to the current URL). Other-origin URLs do a full `location.assign/replace`. `scroll: false` keeps the scroll position. `refresh()` and `prefetch()` are no-ops (there are no server components). |
| `usePathname(): string` | Pathname **with** the locale: `"/ar/dashboard/items/12"` |
| `useSearchParams(): ReadonlyURLSearchParams` | Read-only `URLSearchParams` of the current URL. `set/append/delete/sort` throw, like Next. No `<Suspense>` needed. |
| `useParams<T>(): T` | All dynamic params **including `locale`**, e.g. `{ locale: 'ar', itemId: '12' }`. Values are strings. |
| `notFound(): never` | Throws. The route error boundary renders the 404 page in place of the layouts, like Next's root not-found. Use it during render or in effects, not in event handlers. Rendering `<NotFound/>` (default export of `@/routes/NotFound`) directly is also fine. |
| `redirect(url, type = 'replace'): never` | Throws. The error boundary navigates to `url`. Use it during render or in effects. In event handlers, use `router.replace(url)`. |
| `Link` (named and default export) | Like `next/link`: renders a plain `<a href>`. `href` is a string or `{ pathname, query, hash }`. Supports `replace` and `scroll={false}`. `prefetch`, `passHref`, `legacyBehavior` and `shallow` are accepted and ignored. Every other prop (`className`, `target`, `onClick`, `aria-*`, …) is passed to the `<a>`. A plain left click navigates client-side. Modifier keys, `target` other than `_self`, `download` and other origins fall back to the browser. The href is **not** locale-prefixed. |
| `formatUrl(url)` | UrlObject → string (Next's algorithm). |

```tsx
// before
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
// after
import { useRouter, useSearchParams, Link } from '@/lib/next-compat';

<Link href={`/${locale}/dashboard`} className="…">…</Link>   // unchanged JSX
```

### 4.2 `@/i18n/navigation` — same exports as before (`Link`, `redirect`, `usePathname`, `useRouter`, `getPathname`)

These keep the next-intl 4 semantics (`localePrefix: 'always'`, no `pathnames`). Call sites do not change.

| Export | Semantics |
|---|---|
| `usePathname()` | Path **without** the locale: `/ar/search/5` → `/search/5`, `/ar` → `/` |
| `Link` | `href="/search"` → `<a href="/ar/search">` (current locale). `href={{ pathname: '/dashboard/manage-users/1', query: {…} }}` is supported. `locale="en"` → `/en…`, sets `hreflang="en"`, and writes `NEXT_LOCALE=en;sameSite=lax;path=/;` on click. Absolute URLs (`https://…`) and relative hrefs (not starting with `/`) are not prefixed. Every `@/lib/next-compat` Link prop is supported. |
| `useRouter()` | `push/replace/prefetch(href, { locale?, scroll? })` add the current or given locale prefix and sync the cookie when the locale changes. `back/forward/refresh` are passed through. Stable per locale. |
| `getPathname({ href, locale, forcePrefix? })` | `getPathname({ href: '/search', locale: 'en' })` → `'/en/search'` |
| `redirect({ href, locale }, type?)` | `redirect(getPathname(args))` from next-compat |

Rule of thumb: an href **without** a locale uses `@/i18n/navigation`. An href that **already contains**
`/${locale}` uses `@/lib/next-compat`. Do not mix them, or you get `/ar/ar/...`.

### 4.3 Translations — `use-intl`

```ts
import { useTranslations, useLocale, useFormatter, hasLocale } from 'use-intl';   // was 'next-intl'
```

- Same API and the same messages (`messages/{ar,en}.json`). For `ar`, English is deep-merged underneath
  as a fallback, exactly as in the old `src/i18n/request.ts`. Missing keys log through use-intl's default
  `onError` and render `namespace.key`, as next-intl did.
- `timeZone` is the browser's time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
- Server API mapping: `const t = await getTranslations('ns')` → `const t = useTranslations('ns')`.
  `getTranslations({ locale, namespace })` → `useTranslations(namespace)`, because the locale comes from
  the URL. `getMessages()` → not needed. `getLocale()` → `useLocale()`. Make the component a plain
  (non-async) function.
- `NextIntlClientProvider` → remove it. `LocaleLayout` already provides everything.
- `routing` from `@/i18n/routing` is unchanged (`routing.locales`, `routing.defaultLocale`,
  `getLocaleDirection`). New helpers: `isAppLocale(x)`, type `AppLocale`.

### 4.4 `@/lib/Image` — replaces `next/image`

```tsx
import Image from '@/lib/Image';      // was: import Image from 'next/image'
```

Drop-in replacement. The JSX does not change, and the output `<img>` matches next/image 16 unoptimized
exactly. Checked against the baseline DOM: `data-nimg="1"|"fill"`, `loading="lazy"` (left **out**
with `priority`, like Next 16, plus a preload hint), `decoding="async"`, integer
`width`/`height`, `style="color:transparent"` (removed after a load error), and for `fill`:
`position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0`. `src` can be a string or a
static import (a string in Vite; objects with `.src` also work). `sizes`, `quality`, `unoptimized` and
`loader` are accepted and ignored. Nothing emits `srcset` or `sizes`. `ref`, `onLoad`, `onError`,
`className`, `style` and the rest are passed through. Plan §3 suggested hand-converting to `<img>`.
**Using `@/lib/Image` instead is preferred**, because it guarantees identical attributes.

### 4.5 Runtime config — `@/config`

```ts
import { API_URL } from '@/config';   // replaces process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'
import { config } from '@/config';    // config.MAP_TILES_URL, …
```

| Key | Type | Default | Notes |
|---|---|---|---|
| `API_URL` | string | `http://localhost:8000` | trailing slashes stripped |
| `MAP_TILES_URL` | string | `/map/oman.pmtiles` | `.pmtiles` file or XYZ template |
| `MAP_TILES_TYPE` | `'pmtiles' \| 'xyz' \| 'none'` | `'pmtiles'` | invalid → default |
| `MAP_ATTRIBUTION` | string | `© OpenStreetMap contributors` | |
| `SHOW_EXTERNAL_MAP_LINKS` | boolean | `false` | accepts `true/false/"true"/"1"/…` |

Precedence: `window.__APP_CONFIG__` (from `/config.js`, loaded by `index.html` before the bundle) →
`import.meta.env.VITE_<KEY>` → default. Values are read once at startup. The `window.__APP_CONFIG__`
type is declared in `src/vite-env.d.ts`. Do the replacement mechanically:
`process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000'` (any fallback) → `API_URL`.

### 4.6 Other

- `RequireAuth` (`@/lib/RequireAuth`) also exports `isAuthenticated()`, `isProtectedRoute(path)`,
  `clearAuthCookies()` and `resolveGuard(pathname, search, hash)`. Pages normally don't need them.
- `@/i18n/locale`: `readCookie`, `detectLocale`, `writeLocaleCookie`, … (internal helpers).
- `@/i18n/IntlProvider`: `AppIntlProvider`, `loadMessages`, `applyDocumentLocale` (internal).

---

## 5. Porting recipe (per file)

| Before | After |
|---|---|
| `'use client'` / `"use client"` | delete the line |
| `import { useTranslations, useLocale } from 'next-intl'` | `from 'use-intl'` |
| `import { getTranslations } from 'next-intl/server'` + `await getTranslations(ns)` | `useTranslations(ns)` from `use-intl`, non-async component |
| `import { useRouter, usePathname, useSearchParams, useParams, notFound, redirect } from 'next/navigation'` | `from '@/lib/next-compat'` |
| `import Link from 'next/link'` | `import { Link } from '@/lib/next-compat'` |
| `import Image from 'next/image'` | `import Image from '@/lib/Image'` |
| `import { Link, useRouter, usePathname } from '@/i18n/navigation'` | unchanged |
| `export default function Page({ params }: { params: Promise<{ id: string }> })` + `use(params)` | `export default function Page()` + `const { id } = useParams<{ id: string }>()` |
| `searchParams` page prop | `useSearchParams()` |
| `export const metadata = { title }` / `generateMetadata` | render `<title>{t('…')}</title>` at the top of the page's JSX (React 19 hoists it into `<head>`) |
| `import type { Metadata } from 'next'` | delete |
| `process.env.NEXT_PUBLIC_HOST_NAME \|\| '…'` | `API_URL` from `@/config` |
| `localFont({ src: '…lalezar-400.woff2' })` + `${lalezarFont.className}` | remove `localFont`; use the class Assets defines in `src/styles/fonts.css` (proposed `font-lalezar`). Coordinate with Assets. |

Route components **must default-export a component that takes no props**.

**Titles.** React inserts each newly mounted `<title>` before the existing ones, so the most specific title
wins: page over layout over root. That matches Next's metadata merge. Root gives
`مفقود | MFQOD`, MainLayout gives `مفقود | MFQOD`, DashboardLayout gives `Admin Dashboard`. NotFound renders
**no** `<title>` (PM gate fix): in the baseline a 404 keeps the document title `مفقود | MFQOD`, because Next put
the 404 `<title>` after the root one. A page that had `generateMetadata` (`how-mfqod-works`) renders its own
`<title>`. Do **not** add `<title>` to pages that had no `metadata`/`generateMetadata` in the baseline.
Meta descriptions come from `index.html` only (minor, accepted difference).

---

## 6. Gotchas

1. **styled-jsx is gone.** Next compiled `<style jsx>{`…`}</style>` into scoped CSS. Class selectors got a
   `.jsx-<hash>` suffix and every element in that component got the `jsx-<hash>` class. **`@keyframes`
   names were NOT scoped** (verified in the baseline). Without Next, React renders a plain global `<style>`
   and warns about the `jsx` attribute. Fix: change `<style jsx>` to `<style>`. If the CSS only has
   `@keyframes` and class names that are unique to that component, the result is identical. **Watch out
   for generic selectors**: `SideNavbar.tsx` has `.group:hover::after { … }`. As a global style it
   would hit every `.group` on the page. Scope it yourself, for example with a
   `jsx-sidenavbar`-style class on that component's elements and `.group.jsx-sidenavbar:hover::after`. That is
   exactly what Next produced. Affected files: `components/SplashScreen.tsx`,
   `components/ReturnedItemsSection.tsx`, `components/ui/FilterModal.tsx`, `routes/main/search/DisplayPosts.tsx`,
   `routes/dashboard/SideNavbar.tsx`, `routes/dashboard/items/DisplayItems.tsx`,
   `routes/dashboard/missing-items/DisplayMissingItems.tsx`.
2. **No `process` in the browser.** tsconfig has only `vite/client` types, so any `process.*` is a type
   error. Use `@/config` for runtime values and `import.meta.env.DEV`/`PROD` for build mode.
3. **No SSR.** `typeof window` guards, `ClientOnly`, `HydrationSafeWrapper` and `useIsClient` keep working.
   Leave them in place, because removing them is a markup risk.
4. **`router.refresh()` is a no-op.** If a page relied on it to refetch, it already refetched in a client
   effect. Check before you change anything.
5. **Locale-prefixed vs unprefixed hrefs**: see §4.2. `@/lib/next-compat` `Link`/`router` never add a
   locale. A locale-less path such as `router.push('/auth/login?…')` still works, because RequireAuth
   redirects it to `/<cookie locale>/auth/login?…`, as the old middleware did. Keep such calls as they were.
6. **CSS:** each layout imports its own `globals.css` (both contain `@import "tailwindcss"`, Tailwind 4.1.11
   via `@tailwindcss/vite`, scanning the same sources as before). Once loaded, a lazy chunk's CSS stays in
   the document, as Next's did on client navigation. Don't move CSS imports between files.
7. **`notFound()`/`redirect()` in event handlers** do not reach the error boundary. Use
   `router.replace()` there.
8. **The unauthorized page** used `getAuthenticatedUser()` from the deleted `@/lib/server/permissions`
   (a server-side cookie and `/api/auth/me` check). Port it with the client-side equivalent (for example
   `tokenManager`/`useAuth`) and `<Navigate to={`/${locale}/auth/login`} replace />`.
9. **ESLint** (`eslint.config.js`): typescript-eslint recommended, react-hooks 7.0.1 recommended (same
   version as before, so the same React-Compiler rules), `@eslint/js` recommended, and the old project
   overrides. Plus `no-restricted-imports`, which is an error on `next*`/`next-intl*`. The pre-existing
   `react-hooks/set-state-in-effect` errors in page files are baseline debt. Don't restructure code to
   silence them (behaviour risk). An inline `// eslint-disable-next-line react-hooks/set-state-in-effect -- ported 1:1`
   is acceptable.
10. **No external URLs** in code you touch (plan §5). Icons (`lucide-react`, `react-icons`) are bundled.
11. **Dev pre-bundling**: `vite.config.ts` pre-bundles the heavy deps explicitly, because Vite's dependency
    scan aborts while any file imports an unresolvable module (`next-intl/server`). If a new dependency
    loads slowly in dev, tell Platform/PM.
12. **Typecheck noise**: until every agent finishes, `npm run typecheck` shows errors in other agents'
    files. Filter by your paths: `npx tsc --noEmit -p . 2>&1 | grep '^src/routes/dashboard/items'`.
13. **Static imports from `public/`** (PM gate addition). `Brand.tsx` does
    `import squLogo from "../../../public/squlogo.svg"`. Vite does not support importing files from
    `public/` in JS. Replace it with the URL string (`src="/squlogo.svg"`) and keep the explicit
    `width`/`height`/`className` unchanged. A Vite import has no intrinsic size, unlike Next's static
    import, so an `<Image>` that relied on static-import dimensions must get the same numbers written out.
    Font files are never imported from JS. Fonts come only from `src/styles/fonts.css` (Assets).
14. **Do not edit platform files to make your page work.** That means the shims, `router.tsx`, `config.ts`,
    `i18n/*` and the layouts. Put the need under `requests` in your result. The PM decides.
15. **Verify against the baseline**, not against your memory: the frozen Next app runs on port 3100.
    Compare DOM and attributes (`<a href>`, `<img>` attributes, class lists) of each route you port with the
    same route on 3100.

---

## 7. Requests and notes for other owners

- **Assets:** `src/styles/fonts.css` is yours. It currently holds only
  `html, body { font-family: 'Alexandria', system-ui, arial, sans-serif; }` and is imported first in
  `main.tsx`. Add the `@font-face` rules and a Lalezar utility class for Public (proposed `.font-lalezar`).
  Remember that `next/font` used to add an adjusted fallback face. `MAP_ATTRIBUTION`'s default is plain
  text, so change it in `src/config.ts` via the PM if needed. Please add `dist/` to the ignore files
  (`frontend/.gitignore` is unowned, and the root `.gitignore` is yours). Docker: `npm ci && npm run build`
  → `dist/`. nginx must serve `index.html` for every unknown path (SPA fallback) and must not cache
  `/config.js`.
- **PM (integration):** delete `src/lib/legacy-next/`, the `legacyNextBridge` aliases and the
  `legacyNextEnvBridge` plugin from `vite.config.ts`, once
  `grep -rnE "from ['\"]next(-intl)?[/'\"]|process\.env" src` is empty.
