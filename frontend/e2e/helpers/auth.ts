import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';
import { API_URL, BASE_URL, loadCredentials, type QaCredentials } from './env';

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user: Record<string, unknown> & { id: string };
};

/** Log in against the backend API (same call the app makes). */
export async function apiLogin(request: APIRequestContext, creds: QaCredentials = loadCredentials()!): Promise<LoginResponse> {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email_or_username: creds.email, password: creds.password },
  });
  if (!res.ok()) throw new Error(`API login failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as LoginResponse;
}

/**
 * Put the session where the app keeps it: cookies `token` (1 day), `refresh_token` (7 days)
 * and `user` (JSON, 7 days), URI-encoded, path=/, SameSite=Lax — identical to utils/cookies.ts.
 */
export async function setSessionCookies(context: BrowserContext, data: LoginResponse): Promise<void> {
  const url = new URL(BASE_URL);
  const now = Math.floor(Date.now() / 1000);
  const mk = (name: string, value: string, days: number) => ({
    name,
    value: encodeURIComponent(value),
    domain: url.hostname,
    path: '/',
    expires: now + days * 86400,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  });
  await context.addCookies([
    mk('token', data.access_token, 1),
    mk('refresh_token', data.refresh_token, 7),
    mk('user', JSON.stringify(data.user), 7),
  ]);
}

/** Fast login: API + cookies. */
export async function loginWithCookies(context: BrowserContext, request: APIRequestContext): Promise<LoginResponse> {
  const data = await apiLogin(request);
  await setSessionCookies(context, data);
  return data;
}

/** Real UI login through the login form (the page must already be on /{locale}/auth/login...). */
export async function fillLoginForm(page: Page, creds: QaCredentials = loadCredentials()!): Promise<void> {
  const form = page.locator('form').filter({ has: page.locator('input[type="password"]') }).first();
  await form.locator('input[name="identifier"]').fill(creds.email);
  await form.locator('input[name="password"]').fill(creds.password);
  await form.locator('button[type="submit"]').click();
}

export async function uiLogin(page: Page, locale: 'ar' | 'en' = 'ar'): Promise<void> {
  await page.goto(`/${locale}/auth/login`);
  await fillLoginForm(page);
  await page.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 20_000 });
}

export async function cookieNames(context: BrowserContext): Promise<string[]> {
  return (await context.cookies(BASE_URL)).map((c) => c.name);
}
