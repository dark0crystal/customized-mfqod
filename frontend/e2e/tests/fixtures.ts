import { test as base, expect, type Page } from '@playwright/test';
import { loadCredentials, NO_CREDS_REASON, type QaCredentials } from '../helpers/env';
import { loginWithCookies, type LoginResponse } from '../helpers/auth';

type Fixtures = {
  /** uncaught page errors collected for the default `page` */
  pageErrors: string[];
  creds: QaCredentials;
  /** `page` whose context already carries the QA super-admin session cookies */
  authedPage: Page;
  session: LoginResponse;
};

export const test = base.extend<Fixtures>({
  pageErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await use(errors);
  },
  creds: async ({}, use, testInfo) => {
    const c = loadCredentials();
    testInfo.skip(!c, NO_CREDS_REASON);
    await use(c!);
  },
  session: async ({ context, request, creds }, use) => {
    void creds;
    await use(await loginWithCookies(context, request));
  },
  authedPage: async ({ page, session }, use) => {
    void session;
    await use(page);
  },
});

export { expect };

/** The app's 404 page: a heading that is exactly "404" (baseline: Next default not-found page). */
export function notFound(page: Page) {
  return page.locator('h1, h2').filter({ hasText: /^\s*404\s*$/ }).first();
}

export async function expectNotOnLogin(page: Page) {
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

export async function htmlLangDir(page: Page) {
  return page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
}
