/**
 * Offline / air-gap check.
 * Visits a representative route set and records every request the browser makes. A request whose host
 * is not the app origin or the backend (127.0.0.1:8000 / localhost:8000, plus $ALLOWED_HOSTS) is
 * EXTERNAL and fails the test. Set EXTERNAL_REPORT=/path.json to dump what was found.
 *
 * Expected: FAILS on the original Next app (OSM tiles + cdnjs leaflet markers), PASSES after migration.
 */
import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { IDS, ROUTES } from '../routes';
import { isExternal, loadCredentials, BASE_URL } from '../helpers/env';
import { loginWithCookies } from '../helpers/auth';
import { settle } from '../helpers/stabilize';

type Hit = { route: string; url: string; resourceType: string };

async function visit(page: Page, url: string, hits: Hit[], route: string) {
  const onReq = (r: import('@playwright/test').Request) => {
    if (isExternal(r.url())) hits.push({ route, url: r.url(), resourceType: r.resourceType() });
  };
  page.on('request', onReq);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  // scroll so lazy images / map tiles further down are requested too
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
  });
  await settle(page, 500);
  page.off('request', onReq);
}

test.describe('offline', () => {
  test('no request leaves the app origin or the backend', async ({ page, context, request }) => {
    test.setTimeout(10 * 60_000);
    const hits: Hit[] = [];
    const creds = loadCredentials();
    // OFFLINE_ALL=1 checks every route instead of the representative `offline: true` set.
    const all = process.env.OFFLINE_ALL === '1';
    const routes = ROUTES.filter((r) => (all || r.offline) && !r.auth);
    for (const locale of ['ar', 'en']) for (const r of routes) await visit(page, `/${locale}${r.path}`, hits, `${locale}:${r.name}`);
    const protectedRoutes = ROUTES.filter((r) => (all || r.offline) && r.auth);
    const pdfExports = ['/dashboard/analytics', `/dashboard/items/${IDS.item}`];
    if (creds) {
      await loginWithCookies(context, request);
      for (const locale of ['ar', 'en']) for (const r of protectedRoutes) await visit(page, `/${locale}${r.path}`, hits, `${locale}:${r.name}`);
      // PDF export (html2canvas + jsPDF) must not pull fonts/images from the internet either
      for (const p of pdfExports) {
        const route = `en:pdf-export:${p}`;
        const onReq = (r: import('@playwright/test').Request) => {
          if (isExternal(r.url())) hits.push({ route, url: r.url(), resourceType: r.resourceType() });
        };
        await page.goto(`/en${p}`, { waitUntil: 'domcontentloaded' });
        await settle(page, 1000);
        page.on('request', onReq);
        const dl = page.waitForEvent('download', { timeout: 60_000 });
        await page.getByRole('button', { name: /Export PDF/ }).first().click();
        await dl;
        await settle(page, 500);
        page.off('request', onReq);
      }
    } else {
      test.info().annotations.push({ type: 'warning', description: `protected routes not checked (no QA credentials): ${protectedRoutes.map((r) => r.name).join(', ')}` });
    }

    const byHost: Record<string, number> = {};
    for (const h of hits) byHost[new URL(h.url).host] = (byHost[new URL(h.url).host] || 0) + 1;
    const report = {
      baseUrl: BASE_URL,
      checkedAt: new Date().toISOString(),
      loggedIn: !!creds,
      routesChecked: [...routes.map((r) => r.name), ...(creds ? [...protectedRoutes.map((r) => r.name), ...pdfExports.map((p) => `pdf-export:${p}`)] : [])],
      totalExternal: hits.length,
      byHost,
      uniqueUrls: [...new Set(hits.map((h) => h.url))].sort(),
      byRoute: hits.reduce<Record<string, string[]>>((acc, h) => ((acc[h.route] ||= []).push(h.url), acc), {}),
    };
    if (process.env.EXTERNAL_REPORT) fs.writeFileSync(process.env.EXTERNAL_REPORT, JSON.stringify(report, null, 2));
    await test.info().attach('external-requests.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
    expect(report.uniqueUrls, `external requests by host: ${JSON.stringify(byHost)}`).toEqual([]);
  });

  for (const locale of ['ar', 'en'] as const) {
    test(`body font resolves to Alexandria and is loaded (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await settle(page);
      const info = await page.evaluate(async () => {
        await document.fonts.ready;
        const el = document.querySelector('main p, p, h1') || document.body;
        const family = getComputedStyle(el).fontFamily;
        const faces = Array.from(document.fonts).map((f) => ({ family: f.family.replace(/["']/g, ''), status: f.status, weight: f.weight }));
        const first = family.split(',')[0].trim().replace(/["']/g, '');
        return { family, first, faces, check: document.fonts.check(`16px "${first}"`, 'مفقود MFQOD') };
      });
      expect(info.first.toLowerCase()).toContain('alexandria');
      expect(info.faces.some((f) => /alexandria/i.test(f.family) && f.status === 'loaded'), JSON.stringify(info.faces)).toBeTruthy();
      expect(info.check).toBeTruthy();
    });
  }

  test('fonts are served by the app origin (no third-party font hosts)', async ({ page }) => {
    const fontUrls: string[] = [];
    page.on('request', (r) => r.resourceType() === 'font' && fontUrls.push(r.url()));
    await page.goto('/en');
    await settle(page);
    expect(fontUrls.length).toBeGreaterThan(0);
    for (const u of fontUrls) expect(isExternal(u), u).toBeFalsy();
  });
});
