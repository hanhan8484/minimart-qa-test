import { test, expect } from '@playwright/test';
import { loginViaApi, resetEnv } from '../helpers';
import { addCartItem, clearCartRequest, getProducts } from '../helpers/apiCart';

/**
 * Batch API-A — C-A01 / C-A02 cart API
 */
test.describe('C-A01 / C-A02 cart API', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ request }) => {
    await loginViaApi(request);
    await clearCartRequest(request);
  });

  test('C-A01: same product accumulates and caps at 5', async ({ request }) => {
    const products = await getProducts(request);
    const coffee = products.find((p) => p.name === '手沖咖啡濾杯')!;

    await addCartItem(request, coffee.id, 2);
    await addCartItem(request, coffee.id, 2);
    let cart = await (await request.get('/api/cart')).json();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(4);

    await addCartItem(request, coffee.id, 3);
    cart = await (await request.get('/api/cart')).json();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(5);
    expect(cart.count).toBe(5);

    // Persists on GET
    cart = await (await request.get('/api/cart')).json();
    expect(cart.items[0].quantity).toBe(5);
  });

  test('C-A02: PATCH quantity clamped to 1..min(5, stock)', async ({ request }) => {
    const products = await getProducts(request);
    const coffee = products.find((p) => p.name === '手沖咖啡濾杯')!; // stock 12 → max 5
    const chair = products.find((p) => p.name === '折疊露營椅')!; // stock 1 → max 1

    await addCartItem(request, coffee.id, 1);
    let res = await request.patch(`/api/cart/items/${coffee.id}`, { data: { quantity: 9 } });
    expect(res.ok()).toBeTruthy();
    let cart = await res.json();
    expect(cart.items[0].quantity).toBe(5);

    res = await request.patch(`/api/cart/items/${coffee.id}`, { data: { quantity: 1 } });
    cart = await res.json();
    expect(cart.items[0].quantity).toBe(1);

    await clearCartRequest(request);
    await addCartItem(request, chair.id, 1);
    res = await request.patch(`/api/cart/items/${chair.id}`, { data: { quantity: 2 } });
    cart = await res.json();
    expect(cart.items[0].quantity).toBe(1);
  });
});
