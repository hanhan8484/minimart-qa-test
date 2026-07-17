import { test, expect } from '@playwright/test';
import { loginViaApi, resetEnv } from '../helpers';

/**
 * Batch 1 — G API
 * G-A01: R-1.2 login session
 * G-A02: R-1.1 core API smoke
 */
test.describe('G-A01 / G-A02 auth & API smoke', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('G-A01: demo account login gets usable session', async ({ request }) => {
    const bad = await loginViaApi(request, 'demo@minimart.test', 'wrong-password');
    expect(bad.ok()).toBeFalsy();

    const ok = await loginViaApi(request);
    expect(ok.ok()).toBeTruthy();

    const products = await request.get('/api/products');
    expect(products.ok()).toBeTruthy();
  });

  test('G-A02: core APIs respond after login', async ({ request }) => {
    await loginViaApi(request);

    for (const path of ['/api/products', '/api/cart', '/api/orders', '/api/coupons', '/api/notifications']) {
      const res = await request.get(path);
      expect(res.ok(), `${path} should be OK`).toBeTruthy();
    }
  });
});
