/**
 * Visual capture: every route x locale (ar, en) x viewport (desktop 1440x900, mobile 390x844).
 * Public routes are captured logged out, protected routes logged in (QA credentials).
 *
 *   BASE_URL=http://127.0.0.1:3100 OUT_DIR=/tmp/shots [QA_CREDENTIALS=...] [ONLY=home,guides] npx tsx scripts/capture.ts
 *
 * Output: OUT_DIR/<viewport>/<locale>/<route>.png + OUT_DIR/manifest.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { GLOBAL_MASKS, LOCALES, ROUTES, localeUrl, type RouteSpec } from '../routes';
import { BASE_URL, loadCredentials } from '../helpers/env';
import { apiLogin, setSessionCookies, type LoginResponse } from '../helpers/auth';
import { FREEZE_CSS, settle } from '../helpers/stabilize';

const OUT_DIR = path.resolve(process.env.OUT_DIR || 'out/visual');
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
] as const;
type Viewport = (typeof VIEWPORTS)[number];

type ManifestEntry = {
  file: string;
  route: string;
  locale: string;
  viewport: string;
  auth: boolean;
  url: string;
  finalUrl: string;
  status: number | null;
  width?: number;
  height?: number;
  consoleErrors: string[];
  skipped?: string;
  error?: string;
  /** viewport height used when an inner scroll container (dashboard shell) had to be unrolled */
  expandedTo?: number;
  ms?: number;
};

// Fixed clock so "x minutes ago", greetings and date pickers render the same in every run.
const FIXED_NOW = Date.parse(process.env.FIXED_NOW || '2026-10-26T09:00:00+04:00');

// Upper bound for audit-log rows shown in captures (before any migration test data existed).
const AUDIT_DATE_TO = process.env.AUDIT_DATE_TO || '2026-10-01T00:00:00Z';

async function newContext(browser: Browser, vp: Viewport, session: LoginResponse | null): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
    locale: 'en-US',
    timezoneId: 'Asia/Muscat',
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  await ctx.clock.install({ time: FIXED_NOW }).catch(() => {});
  await ctx.clock.resume().catch(() => {});
  // Passed as a STRING on purpose: tsx/esbuild (keepNames) wraps named inner functions of a serialized
  // callback in `__name(...)`, which does not exist in the page and throws before the freeze is applied.
  await ctx.addInitScript({
    content: `(() => {
      let seed = 42;
      Math.random = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      var css = ${JSON.stringify(FREEZE_CSS)};
      function add() {
        if (document.getElementById('__e2e_freeze')) return;
        var s = document.createElement('style');
        s.id = '__e2e_freeze';
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add);
      else add();
    })();`,
  });
  if (session) await setSessionCookies(ctx, session);
  return ctx;
}

async function scrollThrough(page: Page): Promise<void> {
  // trigger lazy content / intersection observers, then return to top
  await page
    .evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    })
    .catch(() => {});
}

/**
 * The dashboard shell is viewport-high with its own scrolling <main>, so a fullPage screenshot would only show the
 * first screen. Grow the viewport until no visible inner scroll container overflows (max 3 rounds, cap 12000px).
 * Returns the final viewport height, or undefined when nothing had to change. The viewport is restored afterwards
 * by the caller closing the page.
 */
async function expandInnerScroll(page: Page, vp: Viewport): Promise<number | undefined> {
  let height: number = vp.height;
  let lastOverflow = Infinity;
  for (let round = 0; round < 3; round++) {
    const overflow = await page
      .evaluate(() => {
        let max = 0;
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const he = el as HTMLElement;
          if (he.clientHeight < 100) continue;
          const oy = getComputedStyle(he).overflowY;
          if (oy !== 'auto' && oy !== 'scroll') continue;
          max = Math.max(max, he.scrollHeight - he.clientHeight);
        }
        return max;
      })
      .catch(() => 0);
    if (overflow <= 1) break;
    // stop when growing the viewport no longer reduces the overflow (content sized in vh)
    if (round > 0 && overflow >= lastOverflow) break;
    lastOverflow = overflow;
    height = Math.min(12_000, height + overflow);
    await page.setViewportSize({ width: vp.width, height });
    // no network wait here: dashboard pages poll counters, so "networkidle" would just burn its timeout
    await page.waitForTimeout(400);
    await page.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => {});
    if (height >= 12_000) break;
  }
  return height === vp.height ? undefined : height;
}

async function captureOne(ctx: BrowserContext, route: RouteSpec, locale: string, vp: Viewport): Promise<ManifestEntry> {
  const rel = path.join(vp.name, locale, `${route.name}.png`);
  const file = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const url = localeUrl(locale as 'ar' | 'en', route.path);
  const entry: ManifestEntry = { file: rel, route: route.name, locale, viewport: vp.name, auth: route.auth, url, finalUrl: '', status: null, consoleErrors: [] };
  const page = await ctx.newPage();
  if (route.name === 'dashboard-audit-logs') {
    // Audit logs grow whenever anyone (incl. the e2e report tests) changes items. Pin the list to a fixed
    // instant so baseline and candidate captures show the same rows. The rendering itself is untouched.
    // (Routed on this page only: request interception changes resource timing on other pages.)
    await page.route(/\/api\/audit-logs(\/|\?|$)/, (r) => {
      const u = new URL(r.request().url());
      if (r.request().method() === 'GET' && !u.searchParams.has('date_to')) u.searchParams.set('date_to', AUDIT_DATE_TO);
      return r.continue({ url: u.toString() });
    });
  }
  page.on('console', (m) => m.type() === 'error' && entry.consoleErrors.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => entry.consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    entry.status = resp?.status() ?? null;
    await settle(page, route.settleMs ?? 600);
    await scrollThrough(page);
    await settle(page, 300);
    await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {});
    const t0 = Date.now();
    entry.expandedTo = await expandInnerScroll(page, vp);
    if (entry.expandedTo) await settle(page, 200);
    entry.ms = Date.now() - t0;
    entry.finalUrl = page.url().replace(BASE_URL, '');
    const masks = [...GLOBAL_MASKS, ...(route.masks || [])].map((sel) => page.locator(sel));
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide', mask: masks, maskColor: '#FF00FF', timeout: 60_000 });
    const dims = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
    entry.width = dims.w;
    entry.height = dims.h;
  } catch (e) {
    entry.error = String(e).slice(0, 500);
  } finally {
    await page.close();
  }
  return entry;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const creds = loadCredentials();
  const browser = await chromium.launch();
  const manifest: ManifestEntry[] = [];
  const routes = ROUTES.filter((r) => !ONLY.length || ONLY.includes(r.name));
  let session: LoginResponse | null = null;
  if (routes.some((r) => r.auth) && creds) {
    const req = await (await browser.newContext()).request;
    session = await apiLogin(req, creds);
  }
  for (const vp of VIEWPORTS) {
    for (const locale of LOCALES) {
      const anon = await newContext(browser, vp, null);
      const authed = session ? await newContext(browser, vp, session) : null;
      for (const route of routes) {
        if (route.auth && !authed) {
          manifest.push({ file: '', route: route.name, locale, viewport: vp.name, auth: true, url: localeUrl(locale, route.path), finalUrl: '', status: null, consoleErrors: [], skipped: 'no QA credentials' });
          continue;
        }
        const e = await captureOne(route.auth ? authed! : anon, route, locale, vp);
        manifest.push(e);
        console.log(`${e.error ? 'ERR ' : 'ok  '} ${vp.name}/${locale}/${route.name} -> ${e.finalUrl} ${e.error ?? ''}`);
      }
      await anon.close();
      await authed?.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ baseUrl: BASE_URL, capturedAt: new Date().toISOString(), entries: manifest }, null, 2));
  const shots = manifest.filter((m) => m.file && !m.error).length;
  const skipped = manifest.filter((m) => m.skipped).length;
  console.log(`\n${shots} screenshots written to ${OUT_DIR} (${skipped} skipped, ${manifest.filter((m) => m.error).length} errors)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
