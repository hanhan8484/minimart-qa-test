import { test, expect } from '@playwright/test';
import { DEMO_EMAIL, DEMO_PASSWORD, loginViaApi, resetEnv } from '../helpers';

const CORE_APIS = [
  '/api/products',
  '/api/cart',
  '/api/orders',
  '/api/coupons',
  '/api/notifications',
] as const;

function setCookieHeader(headers: Record<string, string>) {
  return headers['set-cookie'] ?? '';
}

/**
 * Batch 1 — G API
 * G-A01: R-1.2 login session
 * G-A02: R-1.1 core API smoke
 * G-A03: API authorization security baseline (PRD extension)
 */
test.describe('G-A01 / G-A02 / G-A03 auth & API smoke', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('G-A01: valid built-in credentials return an HttpOnly session cookie', async ({
    request,
  }) => {
    const response = await loginViaApi(request, DEMO_EMAIL, DEMO_PASSWORD);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const cookie = setCookieHeader(response.headers());
    expect(cookie).toMatch(/(?:^|,\s*)session=[^;]+/i);
    expect(cookie).toMatch(/;\s*HttpOnly(?:;|$)/i);
  });

  test('G-A01: wrong password is rejected without creating a session', async ({ request }) => {
    const response = await loginViaApi(request, DEMO_EMAIL, 'wrong-password');
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({
      error: 'INVALID_CREDENTIALS',
      message: '帳號或密碼錯誤',
    });
    expect(setCookieHeader(response.headers())).not.toMatch(/(?:^|,\s*)session=/i);
  });

  test('G-A01: unknown account is rejected without revealing account existence', async ({
    request,
  }) => {
    const response = await loginViaApi(request, 'unknown@minimart.test', DEMO_PASSWORD);
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({
      error: 'INVALID_CREDENTIALS',
      message: '帳號或密碼錯誤',
    });
    expect(setCookieHeader(response.headers())).not.toMatch(/(?:^|,\s*)session=/i);
  });

  test('DEF-031: session cookie uses Secure and SameSite attributes', async ({ request }) => {
    const response = await loginViaApi(request);
    expect(response.status()).toBe(200);
    const cookie = setCookieHeader(response.headers());
    expect(cookie).toMatch(/;\s*HttpOnly(?:;|$)/i);

    test.fail(
      true,
      'DEF-031: HTTPS session cookie lacks Secure and SameSite attributes (security baseline)',
    );
    expect.soft(cookie).toMatch(/;\s*Secure(?:;|$)/i);
    expect.soft(cookie).toMatch(/;\s*SameSite=(?:Lax|Strict)(?:;|$)/i);
  });

  test('G-A02: authenticated core APIs return their minimum response shapes', async ({
    request,
  }) => {
    const login = await loginViaApi(request);
    expect(login.status()).toBe(200);
    expect(await login.json()).toEqual({ ok: true });
    expect(setCookieHeader(login.headers())).toMatch(/(?:^|,\s*)session=[^;]+/i);

    const products = await request.get('/api/products');
    expect(products.ok(), `GET /api/products: ${products.status()}`).toBeTruthy();
    expect(Array.isArray(await products.json())).toBe(true);

    const cart = await request.get('/api/cart');
    expect(cart.ok(), `GET /api/cart: ${cart.status()}`).toBeTruthy();
    expect(await cart.json()).toMatchObject({
      items: expect.any(Array),
      count: expect.any(Number),
    });

    for (const path of ['/api/orders', '/api/coupons', '/api/notifications'] as const) {
      const response = await request.get(path);
      expect(response.ok(), `GET ${path}: ${response.status()}`).toBeTruthy();
      expect(Array.isArray(await response.json()), `${path} should return an array`).toBe(true);
    }
  });

  for (const path of CORE_APIS) {
    test(`DEF-030: anonymous GET ${path} is rejected`, async ({ request }) => {
      test.fail(
        true,
        `DEF-030: ${path} exposes application data without a session (API authorization baseline)`,
      );
      const response = await request.get(path);
      expect([401, 403]).toContain(response.status());
    });
  }
});
