import { test, expect } from '@playwright/test';
import { loginAsDemo, resetEnv } from '../helpers';
import { PRICING_CASES_DISPLAY } from '../fixtures/pricing-cases';
import {
  applyPricingCaseCart,
  getSummaryValueByLabel,
} from '../helpers/pricing';

/**
 * Batch 4 — C-B10 Display secondary（結帳摘要對齊 golden fixture）
 * Primary：C-A03。禁止在此重算公式。
 *
 * DEF-004: UI 將「滿額折扣」與「優惠券折抵」數值對調顯示（應付／小計／運費仍可能正確）。
 */
test.describe('C-B10 checkout summary display', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  for (const c of PRICING_CASES_DISPLAY) {
    test(`${c.id}: summary strings match fixture`, async ({ page }) => {
      test.setTimeout(90_000);
      // When bulk ≠ coupon, swapped labels make discount-row asserts fail (DEF-004).
      // When both are 0, display still matches fixture so we do not mark expected fail.
      const swapWouldBreak =
        c.expect.bulkDiscount !== c.expect.couponDiscount;
      test.fail(
        swapWouldBreak,
        'DEF-004: checkout summary swaps 滿額折扣 ↔ 優惠券折抵 (R-12.5 / R-2.8)',
      );

      await loginAsDemo(page);
      await applyPricingCaseCart(page, c);
      await page.goto('/checkout');
      await expect(page.getByText('商品小計')).toBeVisible();

      if (c.couponCode && c.expect.couponName) {
        await page.getByRole('radio', { name: new RegExp(c.expect.couponName) }).check();
        await expect
          .poll(async () => getSummaryValueByLabel(page, '應付金額'))
          .toBe(c.display.payable);
      }

      expect(await getSummaryValueByLabel(page, '商品小計')).toBe(c.display.subtotal);
      expect(await getSummaryValueByLabel(page, '滿額折扣')).toBe(c.display.bulkDiscount);
      expect(await getSummaryValueByLabel(page, '優惠券折抵')).toBe(c.display.couponDiscount);
      expect(await getSummaryValueByLabel(page, '運費')).toBe(c.display.shipping);
      expect(await getSummaryValueByLabel(page, '應付金額')).toBe(c.display.payable);
    });
  }
});
