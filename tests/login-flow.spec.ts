import { test, expect, type Page } from '@playwright/test';

/**
 * MiniMart E2E — https://cand1.tail296b14.ts.net/
 *
 * 實際 DOM（從前端 bundle 對過）：
 * - 登入：#login-email / #login-password（連字號，不是底線）
 * - 送出：button[type=submit] 文案「登入」（沒有 .submit）
 * - 列表加購：product-card 內 button「加入購物車」（無 class）
 * - 詳情加購：.add-to-cart-btn
 * - 角標：[data-testid="cart-badge"]（不是 .cart-badge）
 * - 購物車連結：nav 連到 /cart（不是 .cart-icon）
 * - 購物車品名：.cart-row-name（不是 .cart-item-name）
 */
test.describe('MiniMart - login & cart flow', () => {
  test('login → add to cart → open cart', async ({ page }) => {
    test.setTimeout(60_000);

    const email = process.env.TEST_USER || 'demo@minimart.test';
    const password = process.env.TEST_PASS || 'demo1234';

    // 1. Login
    await page.goto('/login');
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);
    await page.locator('form.login-card button[type="submit"]').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.logout-btn')).toBeVisible();
    await expect(page.locator('.account')).toHaveText(email);

    // 2. Clear cart via API (UI 連點「移除」會因 re-render / confirm 不穩定逾時)
    await clearCartViaApi(page);
    await page.reload();
    await expect(page.locator('.product-card').first()).toBeVisible();
    await expect(page.getByTestId('cart-badge')).toHaveCount(0);

    // 3. Add first in-stock product from product list
    const firstBuyableCard = page
      .locator('.product-card')
      .filter({ has: page.getByRole('button', { name: '加入購物車', disabled: false }) })
      .first();
    const productName = (await firstBuyableCard.locator('.product-name').innerText()).trim();
    await firstBuyableCard.getByRole('button', { name: '加入購物車' }).click();

    // Toast confirms add (SPA 列表加購後未必立刻 refreshCounts)
    await expect(page.getByRole('status')).toBeVisible();

    // Reload so SessionProvider 重新拉 /api/cart，角標才會更新
    await page.reload();
    await expect(page.getByTestId('cart-badge')).toHaveText('1');

    // 4. Open cart and verify line item
    await page.getByRole('link', { name: /購物車/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.locator('.cart-row-name')).toHaveText(productName);
  });
});

/** Use session cookie already in the page; avoids flaky remove-button clicks. */
async function clearCartViaApi(page: Page) {
  await page.evaluate(async () => {
    const cartRes = await fetch('/api/cart', { credentials: 'include' });
    const cart = await cartRes.json();
    const items = Array.isArray(cart?.items) ? cart.items : [];
    for (const item of items) {
      const res = await fetch(`/api/cart/items/${item.productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to delete cart item ${item.productId}: ${res.status}`);
      }
    }
  });
}
