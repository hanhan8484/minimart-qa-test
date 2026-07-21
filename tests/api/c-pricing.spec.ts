import { test, expect } from '@playwright/test';
import { loginViaApi, resetEnv } from '../helpers';
import {
  PRICING_CASES_API,
  PRICING_CASES_KNOWN_FAIL,
  type PricingCase,
  type PricingExpect,
} from '../fixtures/pricing-cases';
import { applyPricingCaseCart, previewCheckout } from '../helpers/pricing';

function expectPricing(actual: PricingExpect, pricingCase: PricingCase) {
  expect.soft(actual.subtotal, `${pricingCase.id} subtotal`).toBe(pricingCase.expect.subtotal);
  expect
    .soft(actual.bulkDiscount, `${pricingCase.id} bulkDiscount`)
    .toBe(pricingCase.expect.bulkDiscount);
  expect
    .soft(actual.couponDiscount, `${pricingCase.id} couponDiscount`)
    .toBe(pricingCase.expect.couponDiscount);
  expect.soft(actual.shipping, `${pricingCase.id} shipping`).toBe(pricingCase.expect.shipping);
  expect.soft(actual.payable, `${pricingCase.id} payable`).toBe(pricingCase.expect.payable);
  expect.soft(actual.couponName, `${pricingCase.id} couponName`).toBe(pricingCase.expect.couponName);
}

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
    const login = await loginViaApi(request);
    expect(login.ok(), `POST /api/auth/login: ${login.status()}`).toBeTruthy();
  });

  for (const c of PRICING_CASES_API) {
    test(`${c.id}: ${c.title}`, async ({ request }) => {
      await applyPricingCaseCart(request, c);
      const preview = await previewCheckout(request, c.couponCode);
      expectPricing(preview, c);
    });
  }

  for (const { case: c, defect } of PRICING_CASES_KNOWN_FAIL) {
    test(`${c.id}: ${c.title}`, async ({ request }) => {
      await applyPricingCaseCart(request, c);
      const preview = await previewCheckout(request, c.couponCode);

      test.fail(true, defect);
      expectPricing(preview, c);
    });
  }

  test('R-2.6: total discount caps at subtotal and discounted amount stays non-negative', async () => {
    test.fixme(
      true,
      'No A.1/A.2 fixture can make discounts exceed subtotal; requires a synthetic coupon or pricing test hook',
    );
  });
});
