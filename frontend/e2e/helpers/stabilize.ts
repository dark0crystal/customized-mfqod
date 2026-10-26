import type { Page } from '@playwright/test';

/** CSS injected before screenshots: kill animations, transitions, carets, smooth scroll. */
export const FREEZE_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important;
  transition-duration: 0s !important; transition-delay: 0s !important;
  caret-color: transparent !important; scroll-behavior: auto !important;
}
html { scroll-behavior: auto !important; }
`;

export async function freeze(page: Page): Promise<void> {
  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {});
}

/** Wait for network idle (bounded), web fonts, and two animation frames. */
export async function settle(page: Page, extraMs = 0): Promise<void> {
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => {});
  // images: wait until every <img> currently in the DOM is complete. A loading="lazy" image that is off screen
  // (e.g. inside the closed mobile drawer) is never fetched by the browser, so it is not waited for.
  await page
    .waitForFunction(
      () =>
        Array.from(document.images).every((i) => {
          if (i.complete) return true;
          if (i.loading !== 'lazy') return false;
          const r = i.getBoundingClientRect();
          return r.width === 0 || r.height === 0 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth;
        }),
      null,
      { timeout: 10_000 },
    )
    .catch(() => {});
  if (extraMs) await page.waitForTimeout(extraMs);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined))))).catch(() => {});
}
