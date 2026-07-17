import { test, expect } from '@playwright/test';
import { loginViaApi, resetEnv } from '../helpers';

/** A.2 seed coupons */
const A2 = [
  { code: 'NEWBIE20', name: '新人小禮券', type: 'FIXED', status: '未使用' },
  { code: 'SAVE100', name: '滿千折百券', type: 'FIXED', status: '未使用' },
  { code: 'SAVE300', name: '滿三千折三百券', type: 'FIXED', status: '未使用' },
  { code: 'PCT15', name: '全站 85 折券', type: 'PCT', status: '未使用' },
  { code: 'FREESHIP', name: '免運券', type: 'FREESHIP', status: '未使用' },
  { code: 'EXPIRED50', name: '舊版折五十券', type: 'FIXED', status: '已過期' },
] as const;

/**
 * Batch API-A — V-A01 initial coupons / discount codes
 */
test.describe('V-A01 coupons seed API', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('A.2 coupons present with expected codes and statuses', async ({ request }) => {
    await loginViaApi(request);
    const coupons = await (await request.get('/api/coupons')).json();
    expect(coupons.length).toBeGreaterThanOrEqual(A2.length);

    for (const expected of A2) {
      const c = coupons.find((x: { code: string }) => x.code === expected.code);
      expect(c, expected.code).toBeTruthy();
      expect(c.name).toBe(expected.name);
      expect(c.type).toBe(expected.type);
      expect(c.status).toBe(expected.status);
      expect(c).toHaveProperty('threshold');
      expect(c).toHaveProperty('expiresAt');
      expect(c).toHaveProperty('value');
    }
  });

  test('A.3 discount codes API (WELCOME50 / SHIPFREE)', async ({ request }) => {
    test.fail(
      true,
      'DEF-009: 無折扣碼查詢／領取 API，A.3 無法以 API 驗證（R-4.5／R-17.4）',
    );
    await loginViaApi(request);
    const res = await request.get('/api/discount-codes');
    expect(res.ok()).toBeTruthy();
    const codes = await res.json();
    const list = Array.isArray(codes) ? codes : codes.items || codes.codes;
    const names = list.map((c: { code?: string }) => c.code);
    expect(names).toEqual(expect.arrayContaining(['WELCOME50', 'SHIPFREE']));
  });
});
