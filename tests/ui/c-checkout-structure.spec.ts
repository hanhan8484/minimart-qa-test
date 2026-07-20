import { test, expect } from '@playwright/test';
import {
  applyPricingCaseCart,
  checkoutNoteField,
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
 * Batch B-rest — C-B04 / C-B08 / C-B09 / C-B11 / C-B12
 * C-B12 = v2.1 新增（R-12.12 訂單備註結帳 UI）
 */
test.describe.serial('C-B04 / C-B08 / C-B09 / C-B11 / C-B12 checkout UI', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('C-B04: five blocks (v2.1), summary order, COD only', async ({ page }) => {
    await loginAsDemo(page);
    await applyPricingCaseCart(page, CASE_R56_2);
    await page.goto('/checkout');
    await expect(page.locator('.checkout-page')).toBeVisible();

    // R-12.1 v2.1：收件資訊 → 訂單備註 → 優惠券 → 金額摘要 → 付款方式與送出
    await expect(page.getByRole('heading', { name: '收件資訊' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '訂單備註' })).toBeVisible();
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

  /** v2.1 — R-12.12 */
  test('C-B12: order note between shipping and coupons; counter 0/100; blank ok', async ({
    page,
  }) => {
    await loginAsDemo(page);
    await applyPricingCaseCart(page, CASE_R56_2);
    await page.goto('/checkout');
    await expect(page.locator('#checkout-name')).toBeVisible({ timeout: 20_000 });
    await fillCheckoutShipping(page);
    await expect(checkoutNoteField(page)).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('訂單備註（選填）')).toBeVisible();
    const pageText = await page.locator('.checkout-page, main').first().innerText();
    const iShip = pageText.indexOf('收件資訊');
    const iNote = pageText.indexOf('訂單備註');
    const iCoupon = pageText.indexOf('優惠券');
    expect(iShip).toBeGreaterThanOrEqual(0);
    expect(iNote).toBeGreaterThan(iShip);
    expect(iCoupon).toBeGreaterThan(iNote);

    await expect(page.getByText('0/100')).toBeVisible();
    // 備註留空不導致送出停用（R-12.6 / R-12.12）
    await expect(page.locator('.checkout-submit-btn')).toBeEnabled();
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
