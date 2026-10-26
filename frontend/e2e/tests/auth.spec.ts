import { test, expect, expectNotOnLogin, notFound } from './fixtures';
import { fillLoginForm, cookieNames } from '../helpers/auth';

test.describe('auth guard', () => {
  for (const path of ['/ar/dashboard', '/en/dashboard/items', '/ar/search']) {
    test(`anonymous ${path} redirects to login with returnUrl`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL((u) => u.pathname === `/${path.split('/')[1]}/auth/login` && u.searchParams.get('returnUrl') === path);
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });
  }

  test('anonymous /ar/unauthorized redirects to /ar/auth/login', async ({ page }) => {
    await page.goto('/ar/unauthorized');
    await expect(page).toHaveURL((u) => u.pathname === '/ar/auth/login');
  });

  // Baseline: next-intl locale detection — Accept-Language picks en/ar, anything else -> default 'ar'.
  for (const [accept, expected] of [['ar', '/ar'], ['en-US', '/en'], ['fr-FR', '/ar']] as const) {
    test(`root / with Accept-Language ${accept} redirects to ${expected}`, async ({ browser }) => {
      const ctx = await browser.newContext({ locale: accept });
      const page = await ctx.newPage();
      await page.goto('/');
      await expect(page).toHaveURL((u) => u.pathname === expected);
      await ctx.close();
    });
  }

  test('auth guard matches by prefix: anonymous /en/dashboard-anything also goes to login', async ({ page }) => {
    await page.goto('/en/dashboard-nope/x');
    await expect(page).toHaveURL((u) => u.pathname === '/en/auth/login' && u.searchParams.get('returnUrl') === '/en/dashboard-nope/x');
  });

  // BASELINE BUG, encoded on purpose: the guard puts the full path incl. locale in returnUrl (/ar/dashboard) and the
  // login page hands it to the locale-aware router, which prefixes the locale again -> /ar/ar/dashboard -> 404.
  // If the migration fixes this (a deliberate behaviour change), update this test to expect /ar/dashboard.
  test('login via the form with returnUrl (baseline: lands on /ar/ar/dashboard, a 404)', async ({ page, creds }) => {
    void creds;
    await page.goto('/ar/dashboard');
    await expect(page).toHaveURL((u) => u.pathname === '/ar/auth/login' && u.searchParams.get('returnUrl') === '/ar/dashboard');
    await fillLoginForm(page);
    await page.waitForURL((u) => u.pathname === '/ar/ar/dashboard', { timeout: 20_000 });
    await expect(notFound(page)).toBeVisible();
    expect(await cookieNames(page.context())).toEqual(expect.arrayContaining(['token', 'refresh_token', 'user']));
  });

  test('login via the form without returnUrl lands on the locale home', async ({ page, creds }) => {
    void creds;
    await page.goto('/en/auth/login');
    await fillLoginForm(page);
    await page.waitForURL((u) => u.pathname === '/en', { timeout: 20_000 });
    expect(await cookieNames(page.context())).toEqual(expect.arrayContaining(['token', 'refresh_token', 'user']));
  });

  test('wrong password shows an error and stays on login', async ({ page, creds }) => {
    await page.goto('/en/auth/login');
    await page.locator('input[name="identifier"]').fill(creds.email);
    await page.locator('input[name="password"]').fill('definitely-wrong-password');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('.text-red-500, .text-red-600, .text-red-700, [role="alert"]').first()).toBeVisible();
    await expect(page).toHaveURL(/\/en\/auth\/login/);
  });

  test('logout from the dashboard clears the session and lands on login', async ({ authedPage: page }) => {
    await page.goto('/en/dashboard');
    await expectNotOnLogin(page);
    await page.getByRole('button', { name: /^\s*(Logout|تسجيل الخروج)\s*$/ }).first().click();
    await page.waitForURL(/\/auth\/login/, { timeout: 20_000 });
    expect(await cookieNames(page.context())).not.toContain('token');
    await page.goto('/en/dashboard');
    await expect(page).toHaveURL(/\/en\/auth\/login\?returnUrl=/);
  });
});
