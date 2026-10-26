import fs from 'node:fs';
import { test, expect, expectNotOnLogin, notFound } from './fixtures';
import { IDS, ROUTES } from '../routes';

test.describe('dashboard pages (super admin)', () => {
  for (const r of ROUTES.filter((r) => r.auth && r.path.startsWith('/dashboard'))) {
    test(`en${r.path} renders`, async ({ authedPage: page, pageErrors }) => {
      await page.goto(`/en${r.path}`);
      await expectNotOnLogin(page);
      await expect(page).not.toHaveURL(/\/unauthorized/);
      await expect(notFound(page)).toHaveCount(0);
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
      expect(pageErrors).toEqual([]);
    });
  }

  test('claims list links to a claim detail', async ({ authedPage: page }) => {
    await page.goto('/en/dashboard/claims');
    const link = page.locator('a[href*="/dashboard/claims/"]').first();
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await page.waitForURL(/\/en\/dashboard\/claims\/[0-9a-f-]{36}$/);
    await expect(notFound(page)).toHaveCount(0);
  });

  test('claim detail by URL shows the claim', async ({ authedPage: page }) => {
    await page.goto(`/en/dashboard/claims/${IDS.claim}`);
    await expect(page.getByText('test test').first()).toBeVisible({ timeout: 20_000 });
  });

  // Baseline: the page is a search form (no list until you search by email); each result links to the detail page.
  test('manage users: search by email links to the user detail', async ({ authedPage: page, creds }) => {
    await page.goto('/en/dashboard/manage-users');
    await page.locator('input#email').fill(creds.email);
    await page.locator('form button[type="submit"]').click();
    const link = page.locator('a[href*="/dashboard/manage-users/"]').first();
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await page.waitForURL(new RegExp(`/en/dashboard/manage-users/${creds.user_id}$`));
    await expect(notFound(page)).toHaveCount(0);
    await expect(page.getByText(creds.email).first()).toBeVisible({ timeout: 20_000 });
  });

  test('user detail by URL shows the user', async ({ authedPage: page }) => {
    await page.goto(`/en/dashboard/manage-users/${IDS.user}`);
    await expect(page.getByText('Al-Mardas').first()).toBeVisible({ timeout: 20_000 });
  });

  test('permissions page lists roles/permissions', async ({ authedPage: page }) => {
    await page.goto('/en/dashboard/permissions');
    await expect(page.getByText(/super_admin|moderator/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('analytics renders charts and exports a PDF', async ({ authedPage: page }) => {
    await page.goto('/en/dashboard/analytics');
    await expect(page.locator('.recharts-surface, .recharts-wrapper svg').first()).toBeVisible({ timeout: 20_000 });
    const dl = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: /Export PDF/ }).click();
    const d = await dl;
    expect(d.suggestedFilename()).toMatch(/\.pdf$/i);
    const p = await d.path();
    const head = fs.readFileSync(p).subarray(0, 5).toString();
    expect(head).toBe('%PDF-');
  });

  test('dashboard item detail by URL', async ({ authedPage: page }) => {
    await page.goto(`/en/dashboard/items/${IDS.item}`);
    await expectNotOnLogin(page);
    await expect(notFound(page)).toHaveCount(0);
  });
});
