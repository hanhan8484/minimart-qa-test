import { test, expect } from '@playwright/test';
import {
  addFirstInStockViaApi,
  clearCartViaApi,
  fetchOrderIds,
  fillCheckoutShipping,
  goCheckoutFromCart,
  loginAsDemo,
  resetEnv,
} from '../helpers';

/**
 * Batch 2 — C-C02 R-12.8/R-12.9/R-13.x checkout success path
 */
test.describe('C-C02 checkout success', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('submit order shows complete page, empties cart, blocks double submit', async ({ page }) => {
    test.setTimeout(90_000);

    await loginAsDemo(page);
    await clearCartViaApi(page);
    await addFirstInStockViaApi(page);

    await goCheckoutFromCart(page);
    await expect(page.getByText('貨到付款')).toBeVisible();
    await expect(page.locator('.checkout-submit-btn')).toBeDisabled();

    await fillCheckoutShipping(page);
    const submit = page.locator('.checkout-submit-btn');
    await expect(submit).toBeEnabled();

    const orderIdsBefore = await fetchOrderIds(page);

    let checkoutPostCount = 0;
    await page.route('**/api/checkout**', async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      if (req.method() === 'POST' && path === '/api/checkout') {
        checkoutPostCount += 1;
      }
      await route.continue();
    });

    // Rapid double-click: sync DOM clicks (closer to manual UI) + parallel Playwright clicks
    await Promise.all([
      page.waitForURL(/\/orders\/.+\/complete/, { timeout: 30_000 }),
      (async () => {
        await page.evaluate(() => {
          const btn = document.querySelector('.checkout-submit-btn') as HTMLButtonElement | null;
          btn?.click();
          btn?.click();
        });
        await Promise.all([submit.click(), submit.click()]).catch(() => {});
      })(),
    ]);

    await expect(page.getByRole('heading', { name: '訂單已成立' })).toBeVisible();
    await expect(page.getByText(/MM-\d{8}-\d{4}/)).toBeVisible();
    await expect(page.getByText(/預計出貨/)).toBeVisible();
    // Live UI uses <button>, not <a> (PRD says 按鈕)
    await expect(page.getByRole('button', { name: '查看訂單' })).toBeVisible();
    await expect(page.getByRole('button', { name: '繼續購物' })).toBeVisible();

    // No detailed line items / full amount breakdown on complete page (R-13.5)
    await expect(page.getByText('滿額折扣')).toHaveCount(0);

    await page.goto('/cart');
    await expect(page.locator('.cart-empty-text')).toHaveText('購物車是空的');

    // R-12.8: one checkout action → exactly one new order / one POST
    test.fail(
      true,
      'DEF-024: 快速雙擊「送出訂單」仍可能建立多筆訂單（R-12.8）；手動／同步 DOM 雙擊可重現',
    );
    const orderIdsAfter = await fetchOrderIds(page);
    expect(orderIdsAfter.length).toBe(orderIdsBefore.length + 1);
    expect(checkoutPostCount).toBe(1);
  });
});
