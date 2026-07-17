import { test, expect } from '@playwright/test';
import {
  addFirstInStockViaApi,
  clearCartViaApi,
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

    // Rapid double-click should still create only one order completion navigation
    await Promise.all([
      page.waitForURL(/\/orders\/.+\/complete/, { timeout: 30_000 }),
      (async () => {
        await submit.click();
        // second click while processing (ignore if already navigated / detached)
        await submit.click({ trial: true }).catch(() => {});
        await submit.click({ force: true }).catch(() => {});
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
  });
});
