import { test, expect } from '@playwright/test';
import { clearCartViaApi, loginAsDemo, resetEnv } from '../helpers';

/**
 * Batch 1 — end-to-end smoke: login → add → cart
 * Ties G + P + C happy path (replaces old login-flow.spec.ts)
 */
test.describe('Flow: login → add to cart → open cart', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('login, add first in-stock product, see it in cart with badge 1', async ({ page }) => {
    test.setTimeout(60_000);

    await loginAsDemo(page);
    await clearCartViaApi(page);
    await page.reload();
    await expect(page.getByTestId('cart-badge')).toHaveCount(0);

    const card = page
      .locator('.product-card')
      .filter({ has: page.getByRole('button', { name: '加入購物車', disabled: false }) })
      .first();
    const productName = (await card.locator('.product-name').innerText()).trim();
    await card.getByRole('button', { name: '加入購物車' }).click();
    await expect(page.getByRole('status')).toContainText('已加入購物車');

    await page.reload();
    await expect(page.getByTestId('cart-badge')).toHaveText('1');

    await page.getByRole('link', { name: /購物車/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.locator('.cart-row-name')).toHaveText(productName);
  });
});
