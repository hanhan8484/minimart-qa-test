import { test, expect } from '@playwright/test';
import {
  addFirstInStockViaApi,
  applyPricingCaseCart,
  clearCartViaApi,
  fillCheckoutShipping,
  getSummaryValueByLabel,
  goCheckoutFromCart,
  loginAsDemo,
  resetEnv,
  submitCheckout,
} from '../helpers';
import { CASE_SHIP_LT500 } from '../fixtures/pricing-cases';

/**
 * Batch 10 — C-B05 / C-B06 checkout coupons
 * R-12.3, R-4.11, R-12.4, R-4.10
 */
test.describe.serial('C-B05 / C-B06 checkout coupons', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('C-B05: default none; threshold/expired reasons', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsDemo(page);
    await applyPricingCaseCart(page, CASE_SHIP_LT500);
    await page.goto('/checkout');

    await expect(page.getByRole('radio', { name: '不使用優惠券' })).toBeChecked();
    await expect(page.getByRole('radio', { name: /新人小禮券/ })).toBeEnabled();
    await expect(page.getByRole('radio', { name: /免運券/ })).toBeEnabled();

    const disabled = page.locator('.coupon-option-disabled');
    await expect(disabled.filter({ hasText: '滿千折百券' })).toContainText('未達使用門檻 NT$1,000');
    await expect(disabled.filter({ hasText: '滿三千折三百券' })).toContainText('未達使用門檻 NT$3,000');
    await expect(disabled.filter({ hasText: '全站 85 折券' })).toContainText('未達使用門檻 NT$800');
    await expect(disabled.filter({ hasText: '舊版折五十券' })).toContainText('已過期');
  });

  test('C-B06: select / switch / clear coupon updates payable', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsDemo(page);
    await applyPricingCaseCart(page, CASE_SHIP_LT500);
    await page.goto('/checkout');
    await expect(page.getByText('應付金額')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="summary-row-label"]').filter({ hasText: '應付金額' })).toBeVisible();

    expect(await getSummaryValueByLabel(page, '應付金額')).toBe('NT$560');

    page.once('dialog', () => {
      throw new Error('Unexpected confirm dialog when switching coupons');
    });

    await page.getByRole('radio', { name: /新人小禮券/ }).check();
    await expect.poll(async () => getSummaryValueByLabel(page, '應付金額')).toBe('NT$540');

    await page.getByRole('radio', { name: /免運券/ }).check();
    await expect.poll(async () => getSummaryValueByLabel(page, '應付金額')).toBe('NT$480');

    await page.getByRole('radio', { name: '不使用優惠券' }).check();
    await expect.poll(async () => getSummaryValueByLabel(page, '應付金額')).toBe('NT$560');
  });

  test('C-B05: used coupon shows 已使用 reason', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsDemo(page);
    await clearCartViaApi(page);
    await addFirstInStockViaApi(page);
    await goCheckoutFromCart(page);
    await fillCheckoutShipping(page);
    await page.getByRole('radio', { name: /新人小禮券/ }).check();
    await submitCheckout(page);

    await clearCartViaApi(page);
    await addFirstInStockViaApi(page);
    await goCheckoutFromCart(page);
    await expect(page.locator('.coupon-option-disabled').filter({ hasText: '新人小禮券' })).toContainText(
      '已使用',
    );
  });
});
