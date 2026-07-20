import { test, expect } from '@playwright/test';
import { loginAsDemo, resetEnv } from '../helpers';
import { SEED_ORDER_IDS, SEED_ORDER_STATUSES } from '../helpers/orders';

/**
 * Batch 3 — O-B01 R-14.1/R-14.2/R-14.3/R-6.1/R-6.10 order list
 * v2.1: DEF-020 itemCount fixed; list sort regressed to oldest→newest (DEF-025).
 */
test.describe('O-B01 order list', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test('real seed: fields + itemCounts by status; open newest detail', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: '我的訂單' })).toBeVisible();

    const rows = page.locator('.order-row');
    await expect(rows).toHaveCount(3);

    // A.4 counts by status (independent of list sort)
    const byStatus: Record<string, string> = {
      待出貨: '1 件',
      已完成: '2 件',
      已出貨: '2 件',
    };
    for (const status of SEED_ORDER_STATUSES) {
      const row = rows.filter({ has: page.locator('.order-row-status', { hasText: status }) });
      await expect(row).toHaveCount(1);
      await expect(row.locator('.order-row-createdAt')).not.toBeEmpty();
      await expect(row.locator('.order-row-payable')).toContainText('NT$');
      await expect(row.locator('.order-row-itemCount')).toHaveText(byStatus[status]);
    }

    await expect(page.getByRole('button', { name: /刪除/ })).toHaveCount(0);

    // Open 待出貨 (newest seed) regardless of row index
    const pending = rows.filter({ has: page.locator('.order-row-status', { hasText: '待出貨' }) });
    await pending.click();
    await expect(page).toHaveURL(new RegExp(`/orders/${SEED_ORDER_IDS[0]}$`));
    await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible();
    await expect(page.getByText(SEED_ORDER_IDS[0])).toBeVisible();
  });

  test('DEF-025: list order must be newest→oldest (R-14.1)', async ({ page }) => {
    test.fail(
      true,
      'DEF-025: v2.1 訂單列表改為舊→新（已出貨在最上），違反 R-14.1 新→舊',
    );
    await page.goto('/orders');
    const rows = page.locator('.order-row');
    for (let i = 0; i < 3; i++) {
      await expect(rows.nth(i).locator('.order-row-id')).toHaveText(SEED_ORDER_IDS[i]);
      await expect(rows.nth(i).locator('.order-row-status')).toHaveText(SEED_ORDER_STATUSES[i]);
    }
  });

  test('O-B01 @mock: empty orders shows empty copy', async ({ page }) => {
    await page.route('**/api/orders**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const path = new URL(route.request().url()).pathname;
      if (!/\/api\/orders\/?$/.test(path)) return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/orders');
    await expect(page.getByText('還沒有任何訂單')).toBeVisible();
    await expect(page.getByRole('link', { name: '去逛逛' })).toBeVisible();
  });
});
