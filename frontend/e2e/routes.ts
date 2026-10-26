/**
 * Route manifest — every page URL of the MFQOD frontend.
 *
 * Paths are locale-less; the locale prefix (/ar or /en) is added by the caller.
 * Source of truth: the original Next app's src/app tree (31 pages incl. home).
 * Dynamic ids are real rows from the dev database (override with env vars when
 * running against another dataset).
 */

export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const IDS = {
  /** approved, visible found item (also used for /search/:id) */
  item: process.env.E2E_ITEM_ID || '6c3676b3-b5a3-4664-9c9a-e0af00816f56',
  claim: process.env.E2E_CLAIM_ID || 'c5da8020-5381-416c-b6db-e1131cccc146',
  missingItem: process.env.E2E_MISSING_ITEM_ID || '9b61c39b-58b0-48fa-950f-f1ed0af91fb0',
  user: process.env.E2E_USER_ID || '4332c6f5-b0c9-4204-b60c-7c88cc7f0505',
};

export type RouteSpec = {
  /** stable name, used for screenshot file names */
  name: string;
  /** path without locale prefix ('' = home) */
  path: string;
  /** true when the original app redirects anonymous users to /auth/login */
  auth: boolean;
  /** route-specific CSS selectors to mask in screenshots (in addition to GLOBAL_MASKS) */
  masks?: string[];
  /** extra settle time (ms) after network idle, e.g. splash screen / chart animations */
  settleMs?: number;
  /** part of the representative offline-check set */
  offline?: boolean;
};

export const ROUTES: RouteSpec[] = [
  // ---- public (main) ----
  { name: 'home', path: '', auth: false, settleMs: 3200, offline: true },
  { name: 'guides', path: '/guides', auth: false, offline: true },
  { name: 'how-mfqod-works', path: '/how-mfqod-works', auth: false, offline: true },
  { name: 'branches-info', path: '/branches-info', auth: false, masks: ['.leaflet-container'], offline: true },
  { name: 'legal-privacy-terms', path: '/legal/privacy-terms', auth: false, offline: true },
  { name: 'auth-login', path: '/auth/login', auth: false, offline: true },
  { name: 'auth-register', path: '/auth/register', auth: false, offline: true },
  { name: 'auth-forgot-password', path: '/auth/forgot-password', auth: false, offline: true },
  { name: 'auth-reset-password', path: '/auth/reset-password', auth: false, offline: true },
  // anonymous visitors are redirected to /auth/login (WITHOUT returnUrl) by the page itself
  { name: 'unauthorized', path: '/unauthorized', auth: true },
  // ---- protected by proxy (search) ----
  { name: 'search', path: '/search', auth: true, offline: true },
  { name: 'search-detail', path: `/search/${IDS.item}`, auth: true, offline: true },
  // ---- dashboard ----
  { name: 'dashboard', path: '/dashboard', auth: true, offline: true },
  { name: 'dashboard-analytics', path: '/dashboard/analytics', auth: true, settleMs: 1500, offline: true },
  { name: 'dashboard-audit-logs', path: '/dashboard/audit-logs', auth: true },
  { name: 'dashboard-branch', path: '/dashboard/branch', auth: true },
  { name: 'dashboard-claims', path: '/dashboard/claims', auth: true },
  { name: 'dashboard-claim-detail', path: `/dashboard/claims/${IDS.claim}`, auth: true },
  { name: 'dashboard-help', path: '/dashboard/help', auth: true },
  { name: 'dashboard-item-types', path: '/dashboard/item-types', auth: true },
  { name: 'dashboard-items', path: '/dashboard/items', auth: true, offline: true },
  { name: 'dashboard-item-detail', path: `/dashboard/items/${IDS.item}`, auth: true, offline: true },
  { name: 'dashboard-manage-users', path: '/dashboard/manage-users', auth: true },
  { name: 'dashboard-user-detail', path: `/dashboard/manage-users/${IDS.user}`, auth: true },
  { name: 'dashboard-missing-items', path: '/dashboard/missing-items', auth: true },
  { name: 'dashboard-missing-item-detail', path: `/dashboard/missing-items/${IDS.missingItem}`, auth: true },
  { name: 'dashboard-permissions', path: '/dashboard/permissions', auth: true },
  { name: 'dashboard-report-found-item', path: '/dashboard/report-found-item', auth: true },
  { name: 'dashboard-report-missing-item', path: '/dashboard/report-missing-item', auth: true },
  { name: 'dashboard-transfer-requests', path: '/dashboard/transfer-requests', auth: true },
];

/** Not-found probes (expected to render the 404 page). */
export const NOT_FOUND_URLS = ['/ar/this-route-does-not-exist', '/en/this-route-does-not-exist', '/xx/dashboard'];

/**
 * Masks applied on every screenshot. Keep this list framework-agnostic
 * (attribute/class selectors present in the app's own markup, not Next internals).
 */
export const GLOBAL_MASKS: string[] = [
  '.leaflet-container',          // map tiles (network-dependent)
  '[data-e2e-mask]',             // opt-in hook
];

export function localeUrl(locale: Locale, path: string): string {
  return `/${locale}${path}`;
}
