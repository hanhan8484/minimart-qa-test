import { test, expect } from '@playwright/test';
import { loginAsDemo, resetEnv } from '../helpers';
import { PRICING_CASES_DISPLAY } from '../fixtures/pricing-cases';
import {
  applyPricingCaseCart,
  getSummaryValueByLabel,
  looksLikeDef004DiscountSwap,
} from '../helpers/pricing';

/**
 * Batch 4 — C-B10 Display secondary（結帳摘要對齊 golden fixture）
 * Primary：C-A03。禁止在此重算公式。
 *
 * DEF-004: UI 將「滿額折扣」與「優惠券折抵」數值對調顯示（應付／小計／運費仍可能正確）。
 * `test.fail` 只在觀察到經典對調時啟用，避免券名多餘文字等其它失敗被誤標為 expected。
 */
test.describe('C-B10 checkout summary display', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  for (const c of PRICING_CASES_DISPLAY) {
    test(`${c.id}: summary strings match fixture`, async ({ page }) => {
      test.setTimeout(90_000);

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

      // Hard gates — not covered by DEF-004
      expect(await getSummaryValueByLabel(page, '商品小計')).toBe(c.display.subtotal);
      expect(await getSummaryValueByLabel(page, '運費')).toBe(c.display.shipping);
      expect(await getSummaryValueByLabel(page, '應付金額')).toBe(c.display.payable);

      const bulkShown = await getSummaryValueByLabel(page, '滿額折扣');
      const couponShown = await getSummaryValueByLabel(page, '優惠券折抵');
      test.fail(
        looksLikeDef004DiscountSwap(
          bulkShown,
          couponShown,
          c.display.bulkDiscount,
          c.display.couponDiscount,
        ),
        'DEF-004: checkout summary swaps 滿額折扣 ↔ 優惠券折抵 (R-12.5 / R-2.8); only the swap pattern is expected',
      );
      expect(bulkShown).toBe(c.display.bulkDiscount);
      expect(couponShown).toBe(c.display.couponDiscount);
    });
  }
});
