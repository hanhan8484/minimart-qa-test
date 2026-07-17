import { test, expect } from '@playwright/test';
import { clearCartViaApi, loginAsDemo, resetEnv } from '../helpers';

/**
 * Batch 10 — P-B04 / P-B05 product detail
 * R-10.1～R-10.6
 */
test.describe('P-B04 / P-B05 product detail', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await clearCartViaApi(page);
  });

  test('P-B04: fields, qty bounds (stock≥5 and stock=1), sold-out disables', async ({ page }) => {
    // Coffee id=1 stock 12 → max 5
    await page.goto('/products/1');
    await expect(page.locator('.product-detail-page')).toBeVisible();
    await expect(page.locator('.product-detail-image')).toBeVisible();
    await expect(page.locator('.product-detail-name')).toHaveText('手沖咖啡濾杯');
    await expect(page.locator('.product-detail-category')).toHaveText('廚房');
    await expect(page.locator('.product-detail-price')).toHaveText('NT$480');
    await expect(page.locator('.product-detail-description')).not.toBeEmpty();
    await expect(page.locator('.product-detail-stock')).toHaveText('剩餘 12 件');
    await expect(page.locator('.quantity-picker-value')).toHaveText('1');
    await expect(page.getByRole('button', { name: '減少數量' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '增加數量' })).toBeEnabled();
    await expect(page.locator('.add-to-cart-btn')).toBeEnabled();

    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: '增加數量' }).click();
    }
    await expect(page.locator('.quantity-picker-value')).toHaveText('5');
    await expect(page.getByRole('button', { name: '增加數量' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '減少數量' })).toBeEnabled();

    await page.getByRole('link', { name: '回商品列表' }).click();
    await expect(page).toHaveURL(/\/$/);

    // Camping chair id=7 stock 1 → max 1
    await page.goto('/products/7');
    await expect(page.locator('.product-detail-stock')).toHaveText('剩餘 1 件');
    await expect(page.locator('.quantity-picker-value')).toHaveText('1');
    await expect(page.getByRole('button', { name: '減少數量' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '增加數量' })).toBeDisabled();

    // Mug id=6 sold out
    await page.goto('/products/6');
    await expect(page.locator('.product-detail-stock')).toHaveText('已售完');
    await expect(page.getByRole('button', { name: '減少數量' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '增加數量' })).toBeDisabled();
    await expect(page.locator('.add-to-cart-btn')).toBeDisabled();
  });

  test('P-B05: add to cart from detail uses selected qty + toast', async ({ page }) => {
    await page.goto('/products/1');
    await page.getByRole('button', { name: '增加數量' }).click();
    await page.getByRole('button', { name: '增加數量' }).click();
    await expect(page.locator('.quantity-picker-value')).toHaveText('3');

    await page.locator('.add-to-cart-btn').click();
    await expect(page.getByRole('status')).toContainText('已加入購物車');

    await page.reload();
    await expect(page.getByTestId('cart-badge')).toHaveText('3');
  });
});
