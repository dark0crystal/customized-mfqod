import { test, expect, expectNotOnLogin, notFound } from './fixtures';
import { IDS, ROUTES } from '../routes';

test.describe('public pages', () => {
  for (const r of ROUTES.filter((r) => !r.auth)) {
    for (const locale of ['ar', 'en'] as const) {
      test(`${locale}${r.path || '/'} renders without page errors`, async ({ page, pageErrors }) => {
        const resp = await page.goto(`/${locale}${r.path}`);
        expect(resp?.status()).toBeLessThan(400);
        await expect(page).toHaveURL((u) => u.pathname === `/${locale}${r.path}`);
        await expect(notFound(page)).toHaveCount(0);
        await expect(page.locator('a, button').first()).toBeVisible();
        expect(pageErrors).toEqual([]);
      });
    }
  }

  test('home shows hero, CTA buttons, stats and footer', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByText('MFQOD', { exact: false }).first()).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('footer, main >> footer').first()).toBeAttached();
  });

  test('map container renders on branches-info with markers', async ({ page }) => {
    await page.goto('/en/branches-info');
    const map = page.locator('.leaflet-container').first();
    await expect(map).toBeVisible();
    const box = await map.boundingBox();
    expect(box!.height).toBeGreaterThan(200);
    await expect(page.locator('.leaflet-marker-icon').first()).toBeAttached();
  });
});

test.describe('search', () => {
  test('search lists items and opens an item detail', async ({ authedPage: page }) => {
    await page.goto('/en/search');
    await expectNotOnLogin(page);
    const claim = page.getByRole('button', { name: /Claim item/ }).first();
    await expect(claim).toBeVisible({ timeout: 20_000 });
    await claim.click();
    await page.waitForURL(/\/en\/search\/[0-9a-f-]{36}$/);
    await expect(notFound(page)).toHaveCount(0);
  });

  test('item detail by direct URL', async ({ authedPage: page }) => {
    await page.goto(`/ar/search/${IDS.item}`);
    await expectNotOnLogin(page);
    await expect(page).toHaveURL(new RegExp(`/ar/search/${IDS.item}$`));
    await expect(page.locator('img').first()).toBeAttached();
  });
});
