import { test, expect, notFound } from './fixtures';

test.describe('404', () => {
  for (const url of ['/ar/this-route-does-not-exist', '/en/this-route-does-not-exist', '/en/nope-dir/x']) {
    test(`unknown route ${url} shows 404`, async ({ page }) => {
      await page.goto(url);
      await expect(notFound(page)).toBeVisible();
    });
  }

  for (const url of ['/xx/dashboard', '/fr/guides']) {
    test(`unknown locale ${url} shows 404`, async ({ page }) => {
      // Baseline (Next + next-intl) redirects /xx/... to /ar/xx/... and renders 404 there.
      await page.goto(url);
      await expect(notFound(page)).toBeVisible();
      test.info().annotations.push({ type: 'final-url', description: new URL(page.url()).pathname });
    });
  }
});
