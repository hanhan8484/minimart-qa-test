import { test, expect } from '@playwright/test';
import { loginAsDemo, resetEnv } from '../helpers';
import { SEED_ORDER_IDS, SEED_ORDER_STATUSES } from '../helpers/orders';

/**
 * Batch 3 — O-B01 R-14.1/R-14.2/R-14.3/R-6.1/R-6.10 order list
 */
test.describe('O-B01 order list', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test('real seed: newest→oldest, fields, open detail, not deletable', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: '我的訂單' })).toBeVisible();

    const rows = page.locator('.order-row');
    await expect(rows).toHaveCount(3);

    // A.4 newest→oldest: 保溫瓶×1、蠟燭+T恤×2、濾杯×2
    const expectedCounts = ['1 件', '2 件', '2 件'];
    for (let i = 0; i < 3; i++) {
      const row = rows.nth(i);
      await expect(row.locator('.order-row-id')).toHaveText(SEED_ORDER_IDS[i]);
      await expect(row.locator('.order-row-status')).toHaveText(SEED_ORDER_STATUSES[i]);
      await expect(row.locator('.order-row-createdAt')).not.toBeEmpty();
      await expect(row.locator('.order-row-payable')).toContainText('NT$');
      if (i !== 2) {
        await expect(row.locator('.order-row-itemCount')).toHaveText(expectedCounts[i]);
      }
    }

    // No delete control on list (R-6.10)
    await expect(page.getByRole('button', { name: /刪除/ })).toHaveCount(0);

    await rows.first().click();
    await expect(page).toHaveURL(new RegExp(`/orders/${SEED_ORDER_IDS[0]}$`));
    await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible();
    await expect(page.getByText(SEED_ORDER_IDS[0])).toBeVisible();
  });

  test('DEF-020: seeded 已出貨 order list itemCount should be 2', async ({ page }) => {
    test.fail(
      true,
      'DEF-020: MM-20260710-0001 列表顯示「1 件」，明細為濾杯×2，應為「2 件」（R-14.2／A.4）',
    );
    await page.goto('/orders');
    const row = page.locator('.order-row').filter({ hasText: SEED_ORDER_IDS[2] });
    await expect(row.locator('.order-row-itemCount')).toHaveText('2 件');
  });

  test('O-B01 @mock: empty orders shows empty copy', async ({ page }) => {
    await page.route('**/api/orders**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const path = new URL(route.request().url()).pathname;
      // Only mock list endpoint, not /api/orders/:id
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
