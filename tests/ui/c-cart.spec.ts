import { test, expect } from '@playwright/test';
import { clearCartViaApi, loginAsDemo, resetEnv, setCartLines } from '../helpers';

/**
 * Batch 1 — C cart page basics
 * C-B01 empty cart
 * C-B02 cart row fields
 * C-B03 cart badge count
 */
test.describe('C-B01 / C-B02 / C-B03 cart page', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await clearCartViaApi(page);
  });

  test('C-B01: empty cart UI', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('.cart-page')).toBeVisible();
    await expect(page.locator('.cart-empty-text')).toHaveText('購物車是空的');
    await expect(page.getByRole('link', { name: '去逛逛' })).toBeVisible();
    const checkoutBtn = page.locator('.checkout-btn, button:has-text("前往結帳")');
    await expect(checkoutBtn.first()).toBeVisible();
    await expect(checkoutBtn.first()).toBeDisabled();
  });

  test('C-B02 / C-B03: cart row fields and badge after add', async ({ page }) => {
    await page.goto('/');
    const card = page
      .locator('.product-card')
      .filter({ has: page.getByRole('button', { name: '加入購物車', disabled: false }) })
      .first();
    const productName = (await card.locator('.product-name').innerText()).trim();
    await card.getByRole('button', { name: '加入購物車' }).click();
    await expect(page.getByRole('status')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('cart-badge')).toHaveText('1');

    await page.getByRole('link', { name: /購物車/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    const row = page.locator('.cart-row').first();
    await expect(row.locator('.cart-row-image')).toBeVisible();
    await expect(row.locator('.cart-row-name')).toHaveText(productName);
    await expect(row.locator('.cart-row-price')).toBeVisible();
    await expect(row.locator('.quantity-picker')).toBeVisible();
    await expect(row.locator('.cart-row-linetotal')).toBeVisible();
    await expect(row.locator('.cart-row-remove')).toHaveText('移除');

    await expect(page.locator('.cart-summary')).toBeVisible();
    await expect(page.getByText('商品小計')).toBeVisible();
    await expect(page.getByText('運費')).toHaveCount(0);
    await expect(page.getByText('應付金額')).toHaveCount(0);
  });

  test('C-B02: quantity picker stays within 1..min(5, stock)', async ({ page }) => {
    await setCartLines(page, [{ productName: '手沖咖啡濾杯', quantity: 1 }]);
    await page.goto('/cart');

    let row = page.locator('.cart-row').filter({ hasText: '手沖咖啡濾杯' });
    const decrease = row.getByRole('button', { name: '減少數量' });
    const increase = row.getByRole('button', { name: '增加數量' });
    await expect(row.locator('.quantity-picker-value')).toHaveText('1');
    await expect(decrease).toBeDisabled();

    for (let quantity = 2; quantity <= 5; quantity++) {
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes('/api/cart/items/'),
        ),
        increase.click(),
      ]);
      await expect(row.locator('.quantity-picker-value')).toHaveText(String(quantity));
    }
    await expect(increase).toBeDisabled();
    await expect(decrease).toBeEnabled();

    await clearCartViaApi(page);
    await setCartLines(page, [{ productName: '折疊露營椅', quantity: 1 }]);
    await page.reload();

    row = page.locator('.cart-row').filter({ hasText: '折疊露營椅' });
    await expect(row.locator('.quantity-picker-value')).toHaveText('1');
    await expect(row.getByRole('button', { name: '減少數量' })).toBeDisabled();
    await expect(row.getByRole('button', { name: '增加數量' })).toBeDisabled();
  });

  test('DEF-019: cart badge updates immediately after UI add (no reload)', async ({ page }) => {
    test.fail(true, 'DEF-019: 加入購物車後導覽列徽章未即時更新（需重整才出現）（R-1.4）');
    await page.goto('/');
    await expect(page.getByTestId('cart-badge')).toHaveCount(0);
    await page
      .locator('.product-card')
      .filter({ has: page.getByRole('button', { name: '加入購物車', disabled: false }) })
      .first()
      .getByRole('button', { name: '加入購物車' })
      .click();
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByTestId('cart-badge')).toHaveText('1', { timeout: 3000 });
  });
});
