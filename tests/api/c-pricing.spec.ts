import { test, expect } from '@playwright/test';
import { loginViaApi, resetEnv } from '../helpers';
import { PRICING_CASES_API, PRICING_CASES_KNOWN_FAIL } from '../fixtures/pricing-cases';
import { applyPricingCaseCart, previewCheckout } from '../helpers/pricing';

/**
 * Batch 4 — C-A03 Primary API pricing
 * R-2.2～R-2.7, R-4.*, R-5.* via POST /api/checkout/preview
 */
test.describe('C-A03 checkout pricing preview', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ request }) => {
    await loginViaApi(request);
  });

  for (const c of PRICING_CASES_API) {
    test(`${c.id}: ${c.title}`, async ({ request }) => {
      await applyPricingCaseCart(request, c);
      const preview = await previewCheckout(request, c.couponCode);

      expect(preview.subtotal, 'subtotal').toBe(c.expect.subtotal);
      expect(preview.bulkDiscount, 'bulkDiscount').toBe(c.expect.bulkDiscount);
      expect(preview.couponDiscount, 'couponDiscount').toBe(c.expect.couponDiscount);
      expect(preview.shipping, 'shipping').toBe(c.expect.shipping);
      expect(preview.payable, 'payable').toBe(c.expect.payable);
      expect(preview.couponName, 'couponName').toBe(c.expect.couponName);
    });
  }

  for (const { case: c, defect } of PRICING_CASES_KNOWN_FAIL) {
    test(`${c.id}: ${c.title}`, async ({ request }) => {
      test.fail(true, defect);
      await applyPricingCaseCart(request, c);
      const preview = await previewCheckout(request, c.couponCode);

      expect(preview.subtotal, 'subtotal').toBe(c.expect.subtotal);
      expect(preview.bulkDiscount, 'bulkDiscount').toBe(c.expect.bulkDiscount);
      expect(preview.couponDiscount, 'couponDiscount').toBe(c.expect.couponDiscount);
      expect(preview.shipping, 'shipping').toBe(c.expect.shipping);
      expect(preview.payable, 'payable').toBe(c.expect.payable);
      expect(preview.couponName, 'couponName').toBe(c.expect.couponName);
    });
  }
});
