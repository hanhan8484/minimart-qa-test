import { test, expect } from '@playwright/test';
import { A2_COUPONS, dateFromD0 } from '../fixtures/coupon-cases';
import { loginViaApi, resetEnv } from '../helpers';

type Coupon = {
  code: string;
  name: string;
  type: 'FIXED' | 'PCT' | 'FREESHIP';
  value: number;
  threshold: number;
  expiresAt: string;
  usedByOrderId: string | null;
  status: '未使用' | '已使用' | '已過期';
};

/**
 * Batch API-A — V-A01 initial coupons
 */
test.describe('V-A01 coupons seed API', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('A.2 has exactly six coupons with complete R-4.5 fields', async ({ request }) => {
    const login = await loginViaApi(request);
    expect(login.ok(), `POST /api/auth/login: ${login.status()}`).toBeTruthy();

    const response = await request.get('/api/coupons');
    expect(response.ok(), `GET /api/coupons: ${response.status()}`).toBeTruthy();
    const coupons = (await response.json()) as Coupon[];

    expect(coupons).toHaveLength(A2_COUPONS.length);
    expect(new Set(coupons.map((coupon) => coupon.code)).size).toBe(A2_COUPONS.length);
    expect(coupons.map((coupon) => coupon.code).sort()).toEqual(
      A2_COUPONS.map((coupon) => coupon.code).sort(),
    );

    for (const expected of A2_COUPONS) {
      const actual = coupons.find((coupon) => coupon.code === expected.code);
      expect.soft(actual, expected.code).toBeTruthy();
      if (!actual) continue;

      expect.soft(actual, expected.code).toMatchObject({
        code: expected.code,
        name: expected.name,
        type: expected.type,
        value: expected.value,
        threshold: expected.threshold,
        expiresAt: dateFromD0(expected.expiresInDays),
        usedByOrderId: null,
        status: expected.status,
      });
    }
  });
});
