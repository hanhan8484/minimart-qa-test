import { test, expect } from '@playwright/test';
import {
  applyPricingCaseCart,
  clearCartViaApi,
  fillCheckoutShipping,
  getSummaryValueByLabel,
  goCheckoutFromCart,
  loginAsDemo,
  resetEnv,
  submitCheckout,
} from '../helpers';
import { CASE_R56_2 } from '../fixtures/pricing-cases';

/**
 * Batch B-rest — C-B04 / C-B08 / C-B09 / C-B11
 */
test.describe.serial('C-B04 / C-B08 / C-B09 / C-B11 checkout UI', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('C-B04: four blocks, summary order, COD only', async ({ page }) => {
    await loginAsDemo(page);
    await applyPricingCaseCart(page, CASE_R56_2);
    await page.goto('/checkout');
    await expect(page.locator('.checkout-page')).toBeVisible();

    await expect(page.getByRole('heading', { name: '收件資訊' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '優惠券' })).toBeVisible();
    await expect(page.getByText('商品小計')).toBeVisible();
    // Summary block may lack an explicit「金額摘要」heading; rows are authoritative.
    await expect(page.getByRole('heading', { name: '付款方式' })).toBeVisible();
    await expect(page.getByText('貨到付款')).toBeVisible();
    await expect(page.getByText('信用卡')).toHaveCount(0);

    const labels = await page.locator('[data-testid="summary-row-label"]').allTextContents();
    expect(labels.map((s) => s.trim())).toEqual([
      '商品小計',
      '滿額折扣',
      '優惠券折抵',
      '運費',
      '應付金額',
    ]);

    await expect(page.getByText('滿額折扣')).toBeVisible();
    await expect(page.getByText('優惠券折抵')).toBeVisible();
  });

  test('C-B08: empty cart opening /checkout redirects to /cart', async ({ page }) => {
    await loginAsDemo(page);
    await clearCartViaApi(page);
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.locator('.cart-empty-text')).toHaveText('購物車是空的');
  });

  test('C-B09: stock error stays on checkout; submit re-enabled', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsDemo(page);
    await applyPricingCaseCart(page, CASE_R56_2);
    await page.goto('/checkout');
    await fillCheckoutShipping(page);

    await page.route('**/api/checkout', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'OUT_OF_STOCK',
          message: '商品〈機械式鍵盤〉庫存不足，目前僅剩 0 件',
        }),
      });
    });

    await page.locator('.checkout-submit-btn').click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText('商品〈機械式鍵盤〉庫存不足，目前僅剩 0 件')).toBeVisible();
    await expect(page.locator('.checkout-submit-btn')).toBeEnabled();
    await expect(page.locator('.checkout-submit-btn')).not.toHaveText('處理中…');
  });

  test('C-B11: complete page payable string matches fixture', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsDemo(page);
    await clearCartViaApi(page);
    await applyPricingCaseCart(page, CASE_R56_2);
    await goCheckoutFromCart(page);
    await fillCheckoutShipping(page);
    await submitCheckout(page);
    await expect(page).toHaveURL(/\/complete/);
    await expect(page.getByText(CASE_R56_2.display.payable)).toBeVisible();
  });
});
