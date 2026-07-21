import { test, expect } from '@playwright/test';
import { A1_PRODUCTS, PRODUCT_ORDER, SOLD_OUT_PRODUCT } from '../fixtures/product-cases';
import { loginViaApi, resetEnv } from '../helpers';
import { addCartItem, clearCartRequest, getProducts } from '../helpers/apiCart';

/**
 * Batch API-A — P-A01 / P-A02
 */
test.describe('P-A01 / P-A02 products API', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ request }) => {
    const login = await loginViaApi(request);
    expect(login.ok(), `POST /api/auth/login: ${login.status()}`).toBeTruthy();
  });

  test('P-A01: products exactly match A.1 and expose complete R-3.1 fields', async ({
    request,
  }) => {
    const products = await getProducts(request);
    expect(products).toHaveLength(A1_PRODUCTS.length);
    expect(products.map((product) => product.name)).toEqual(PRODUCT_ORDER);
    expect(new Set(products.map((product) => product.id)).size).toBe(A1_PRODUCTS.length);
    expect(new Set(products.map((product) => product.name)).size).toBe(A1_PRODUCTS.length);

    for (const [index, expected] of A1_PRODUCTS.entries()) {
      const actual = products[index];
      expect.soft(actual, expected.name).toBeTruthy();
      if (!actual) continue;

      expect.soft(actual, expected.name).toMatchObject(expected);
      expect.soft(Number.isInteger(actual.id), `${expected.name} id integer`).toBe(true);
      expect.soft(actual.id, `${expected.name} id positive`).toBeGreaterThan(0);
      expect.soft(Number.isInteger(actual.unitPrice), `${expected.name} price integer`).toBe(true);
      expect.soft(actual.unitPrice, `${expected.name} price non-negative`).toBeGreaterThanOrEqual(0);
      expect.soft(Number.isInteger(actual.stock), `${expected.name} stock integer`).toBe(true);
      expect.soft(actual.stock, `${expected.name} stock non-negative`).toBeGreaterThanOrEqual(0);
      expect
        .soft(actual.imageUrl, `${expected.name} imageUrl`)
        .toMatch(/^\/images\/[^/]+\.(?:svg|png|jpe?g|webp)$/i);
      expect.soft((actual.description ?? '').trim(), `${expected.name} description`).not.toBe('');
    }

    expect(products.find((product) => product.name === SOLD_OUT_PRODUCT)?.stock).toBe(0);
  });

  test('P-A02: adding multiple products changes cart but no product stock', async ({ request }) => {
    const before = await getProducts(request);
    const beforeStocks = Object.fromEntries(
      before.map((product) => [product.id, product.stock] as const),
    );
    const coffee = before.find((product) => product.name === '手沖咖啡濾杯');
    const bottle = before.find((product) => product.name === '不鏽鋼保溫瓶');
    expect(coffee).toBeTruthy();
    expect(bottle).toBeTruthy();
    if (!coffee || !bottle) throw new Error('Required P-A02 products are missing');

    await clearCartRequest(request);
    await addCartItem(request, coffee.id, 2);
    await addCartItem(request, bottle.id, 1);

    const cartResponse = await request.get('/api/cart');
    expect(cartResponse.ok(), `GET /api/cart: ${cartResponse.status()}`).toBeTruthy();
    const cart = await cartResponse.json();
    expect(cart.items).toHaveLength(2);
    expect(cart.count).toBe(3);
    expect(cart.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: coffee.id, quantity: 2 }),
        expect.objectContaining({ productId: bottle.id, quantity: 1 }),
      ]),
    );

    const after = await getProducts(request);
    const afterStocks = Object.fromEntries(
      after.map((product) => [product.id, product.stock] as const),
    );
    expect(afterStocks).toEqual(beforeStocks);
  });
});
