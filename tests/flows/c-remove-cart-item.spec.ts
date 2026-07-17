import { test, expect } from '@playwright/test';
import {
  addFirstInStockViaApi,
  clearCartViaApi,
  loginAsDemo,
  resetEnv,
} from '../helpers';

/**
 * Batch 2 — C-C01 R-11.6 remove confirm dialog
 */
test.describe('C-C01 remove cart item confirm', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('cancel keeps item; confirm removes it', async ({ page }) => {
    test.setTimeout(60_000);

    await loginAsDemo(page);
    await clearCartViaApi(page);
    const { name } = await addFirstInStockViaApi(page);
    await page.goto('/cart');
    await expect(page.locator('.cart-row-name')).toHaveText(name);

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe(`確定要移除〈${name}〉嗎？`);
      await dialog.dismiss();
    });
    await page.locator('.cart-row-remove').click();
    await expect(page.locator('.cart-row-name')).toHaveText(name);

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe(`確定要移除〈${name}〉嗎？`);
      await dialog.accept();
    });
    await page.locator('.cart-row-remove').click();
    await expect(page.locator('.cart-empty-text')).toHaveText('購物車是空的');
  });
});
