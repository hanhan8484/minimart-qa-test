import { test, expect } from '@playwright/test';
import {
  addFirstInStockViaApi,
  clearCartViaApi,
  loginAsDemo,
  resetEnv,
} from '../helpers';

/**
 * Batch 2 — G-C01 R-1.7 logout clears cart
 *
 * DEF-002: server cart is NOT cleared on logout (confirmed via /api/cart).
 * Marked test.fail until product fix; assertion still encodes PRD expectation.
 */
test.describe('G-C01 logout clears cart', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('logout empties cart; login again still empty', async ({ page }) => {
    test.setTimeout(60_000);
    test.fail(true, 'DEF-002: logout does not clear server-side cart (R-1.7)');

    await loginAsDemo(page);
    await clearCartViaApi(page);
    await addFirstInStockViaApi(page);
    await page.reload();
    await expect(page.getByTestId('cart-badge')).toHaveText('1');

    await page.locator('.logout-btn').click();
    await expect(page).toHaveURL(/\/login/);

    await loginAsDemo(page);
    // Wait for session cart refresh from API
    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const cart = await fetch('/api/cart', { credentials: 'include' }).then((r) => r.json());
          return cart?.count ?? cart?.items?.length ?? -1;
        });
      })
      .toBe(0);

    await page.goto('/cart');
    await expect(page.locator('.cart-empty-text')).toHaveText('購物車是空的');
  });
});
