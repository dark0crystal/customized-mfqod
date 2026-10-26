import { test, expect, htmlLangDir, expectNotOnLogin } from './fixtures';

test.describe('language switch', () => {
  for (const path of ['/guides', '/how-mfqod-works', '/branches-info', '']) {
    test(`ar -> en -> ar keeps path ${path || '/'} and flips dir/lang`, async ({ page }) => {
      await page.goto(`/ar${path}`);
      expect(await htmlLangDir(page)).toEqual({ lang: 'ar', dir: 'rtl' });
      await page.getByRole('link', { name: 'English', exact: true }).filter({ visible: true }).first().click();
      await page.waitForURL((u) => u.pathname === `/en${path}`);
      await expect.poll(() => htmlLangDir(page)).toEqual({ lang: 'en', dir: 'ltr' });
      await page.getByRole('link', { name: 'عربي', exact: true }).filter({ visible: true }).first().click();
      await page.waitForURL((u) => u.pathname === `/ar${path}`);
      await expect.poll(() => htmlLangDir(page)).toEqual({ lang: 'ar', dir: 'rtl' });
    });
  }

  test('direct load sets lang/dir per locale', async ({ page }) => {
    await page.goto('/en/auth/login');
    expect(await htmlLangDir(page)).toEqual({ lang: 'en', dir: 'ltr' });
    await page.goto('/ar/auth/login');
    expect(await htmlLangDir(page)).toEqual({ lang: 'ar', dir: 'rtl' });
  });

  test('dashboard language switch keeps the path (logged in)', async ({ authedPage: page }) => {
    await page.goto('/ar/dashboard/items');
    await expectNotOnLogin(page);
    expect(await htmlLangDir(page)).toEqual({ lang: 'ar', dir: 'rtl' });
    await page.goto('/en/dashboard/items');
    await expectNotOnLogin(page);
    expect(await htmlLangDir(page)).toEqual({ lang: 'en', dir: 'ltr' });
  });
});
