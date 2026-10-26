import { test, expect, expectNotOnLogin } from './fixtures';
import type { Page, Response } from '@playwright/test';
import { makeTestImage } from '../helpers/testImage';
import { deleteItem, deleteMissingItem } from '../helpers/cleanup';

const created: { items: string[]; missing: string[] } = { items: [], missing: [] };
let token = '';

/** Pick the first non-empty option of a <select> once options have loaded. */
async function pickFirstOption(page: Page, name: string) {
  const sel = page.locator(`select[name="${name}"]`);
  await expect(sel).toBeVisible();
  await expect.poll(async () => (await sel.locator('option').evaluateAll((os) => os.filter((o) => (o as HTMLOptionElement).value).length)), { timeout: 20_000 }).toBeGreaterThan(0);
  if (await sel.isDisabled()) return;
  const current = await sel.inputValue();
  if (current) return;
  const v = await sel.locator('option').evaluateAll((os) => (os as HTMLOptionElement[]).find((o) => o.value)!.value);
  await sel.selectOption(v);
}

// The backend answers POST /api/items (no trailing slash) with a 307 to /api/items/; the browser follows it.
// Match the final answer, not the redirect hop.
const isPost = (re: RegExp) => (r: Response) =>
  r.request().method() === 'POST' && re.test(new URL(r.url()).pathname) && (r.status() < 300 || r.status() >= 400);

test.describe.serial('report forms (creates E2E- data, deleted in teardown)', () => {
  test.afterAll(async ({ request }) => {
    for (const id of created.items) expect((await deleteItem(request, token, id)).ok(), `delete item ${id}`).toBeTruthy();
    for (const id of created.missing) expect((await deleteMissingItem(request, token, id)).ok(), `delete missing ${id}`).toBeTruthy();
  });

  test('report found item with image upload', async ({ authedPage: page, session }, testInfo) => {
    token = session.access_token;
    const img = makeTestImage(testInfo.outputDir);
    await page.goto('/en/dashboard/report-found-item');
    await expectNotOnLogin(page);
    const title = `E2E-found-${Date.now()}`;
    await page.locator('[name="title"]').fill(title);
    await page.locator('[name="content"]').fill('E2E- automated test item, safe to delete');
    await pickFirstOption(page, 'item_type_id');
    await pickFirstOption(page, 'orgnization');
    await pickFirstOption(page, 'branch_id');
    await page.locator('input[type="file"]').setInputFiles(img);
    await expect(page.locator('img[src^="blob:"], img[src^="data:"]').first()).toBeVisible({ timeout: 15_000 });

    const itemResp = page.waitForResponse(isPost(/\/api\/items\/?$/));
    const uploadResp = page.waitForResponse(isPost(/upload/));
    const addrResp = page.waitForResponse(isPost(/\/api\/addresses\/?$/));
    await page.locator('form button[type="submit"]').click();
    const ir = await itemResp;
    const body = await ir.json().catch(() => ({}));
    if (body?.id) created.items.push(body.id); // record before asserting so teardown always deletes it
    expect(ir.ok(), `POST ${ir.url()} -> ${ir.status()}`).toBeTruthy();
    expect(body.title).toBe(title);
    expect((await uploadResp).ok()).toBeTruthy();
    expect((await addrResp).ok()).toBeTruthy();
  });

  test('report missing item with image upload', async ({ authedPage: page, session }, testInfo) => {
    token = session.access_token;
    const img = makeTestImage(testInfo.outputDir);
    await page.goto('/en/dashboard/report-missing-item');
    await expectNotOnLogin(page);
    const title = `E2E-missing-${Date.now()}`;
    await page.locator('[name="title"]').fill(title);
    await page.locator('[name="content"]').fill('E2E- automated test missing item, safe to delete');
    await pickFirstOption(page, 'item_type_id');
    await pickFirstOption(page, 'orgnization');
    await page.locator('input[type="file"]').setInputFiles(img);

    const miResp = page.waitForResponse(isPost(/\/api\/missing-items\/?$/));
    const uploadResp = page.waitForResponse(isPost(/upload/));
    await page.locator('form button[type="submit"]').click();
    const mr = await miResp;
    const body = await mr.json().catch(() => ({}));
    if (body?.id) created.missing.push(body.id); // record before asserting so teardown always deletes it
    expect(mr.ok(), `POST ${mr.url()} -> ${mr.status()}`).toBeTruthy();
    expect(body.title).toBe(title);
    expect((await uploadResp).ok()).toBeTruthy();
  });
});
