import { test, expect } from '@playwright/test';
import { loginViaApi, resetEnv } from '../helpers';
import { addCartItem, clearCartRequest, getProducts } from '../helpers/apiCart';

async function getCart(request: Parameters<typeof clearCartRequest>[0]) {
  const response = await request.get('/api/cart');
  expect(response.ok(), `GET /api/cart: ${response.status()}`).toBeTruthy();
  return response.json();
}

/**
 * Batch API-A — C-A01 / C-A02 cart API
 */
test.describe('C-A01 / C-A02 cart API', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ request }) => {
    const login = await loginViaApi(request);
    expect(login.ok(), `POST /api/auth/login: ${login.status()}`).toBeTruthy();
    await clearCartRequest(request);
  });

  test('C-A01: same product accumulates and caps at 5', async ({ request }) => {
    const products = await getProducts(request);
    const coffee = products.find((p) => p.name === '手沖咖啡濾杯')!;

    await addCartItem(request, coffee.id, 2);
    await addCartItem(request, coffee.id, 2);
    let cart = await getCart(request);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(coffee.id);
    expect(cart.items[0].quantity).toBe(4);

    await addCartItem(request, coffee.id, 3);
    cart = await getCart(request);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(coffee.id);
    expect(cart.items[0].quantity).toBe(5);
    expect(cart.count).toBe(5);

    // A fresh read still returns server-side cart state (R-11.1 API portion).
    cart = await getCart(request);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(coffee.id);
    expect(cart.items[0].quantity).toBe(5);
  });

  test('C-A02: PATCH preserves quantity within 1..min(5, stock)', async ({ request }) => {
    const products = await getProducts(request);
    const coffee = products.find((p) => p.name === '手沖咖啡濾杯')!; // stock 12 → max 5
    const chair = products.find((p) => p.name === '折疊露營椅')!; // stock 1 → max 1

    await addCartItem(request, coffee.id, 1);
    let res = await request.patch(`/api/cart/items/${coffee.id}`, { data: { quantity: 5 } });
    expect(res.ok(), `PATCH coffee quantity=5: ${res.status()}`).toBeTruthy();
    let cart = await res.json();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(coffee.id);
    expect(cart.items[0].quantity).toBe(5);

    res = await request.patch(`/api/cart/items/${coffee.id}`, { data: { quantity: 1 } });
    expect(res.ok(), `PATCH coffee quantity=1: ${res.status()}`).toBeTruthy();
    cart = await res.json();
    expect(cart.items[0].productId).toBe(coffee.id);
    expect(cart.items[0].quantity).toBe(1);

    await clearCartRequest(request);
    await addCartItem(request, chair.id, 1);
    cart = await getCart(request);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(chair.id);
    expect(cart.items[0].quantity).toBe(1);

    // R-11.5 defines the resulting bound, but not whether an invalid API
    // request must be rejected or normalized. Accept either contract while
    // asserting that persisted state never exceeds current stock.
    res = await request.patch(`/api/cart/items/${chair.id}`, { data: { quantity: 2 } });
    if (res.ok()) {
      cart = await res.json();
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
      cart = await getCart(request);
    }
    expect(cart.items[0].productId).toBe(chair.id);
    expect(cart.items[0].quantity).toBe(1);
  });

  test('DEF-027: POST rejects negative quantity without mutating cart', async ({ request }) => {
    test.fail(
      true,
      'DEF-027: POST /api/cart/items accepts quantity=-9 and violates R-11.5 cart quantity lower bound',
    );

    const products = await getProducts(request);
    const coffee = products.find((p) => p.name === '手沖咖啡濾杯')!;
    const response = await request.post('/api/cart/items', {
      data: { productId: coffee.id, quantity: -9 },
    });

    expect.soft(response.ok(), `unexpected status ${response.status()}`).toBeFalsy();
    expect.soft(response.status()).toBeGreaterThanOrEqual(400);
    expect.soft(response.status()).toBeLessThan(500);

    const cart = await getCart(request);
    expect(cart.items).toHaveLength(0);
    expect(cart.count).toBe(0);
  });

  test('DEF-028: POST rejects sold-out product without mutating cart', async ({ request }) => {
    test.fail(
      true,
      'DEF-028: POST /api/cart/items accepts stock=0 product and violates R-11.5 cart stock bound',
    );

    const products = await getProducts(request);
    const mug = products.find((p) => p.name === '陶瓷馬克杯')!;
    expect(mug.stock).toBe(0);

    const response = await request.post('/api/cart/items', {
      data: { productId: mug.id, quantity: 1 },
    });

    expect.soft(response.ok(), `unexpected status ${response.status()}`).toBeFalsy();
    expect.soft(response.status()).toBeGreaterThanOrEqual(400);
    expect.soft(response.status()).toBeLessThan(500);

    const cart = await getCart(request);
    expect(cart.items).toHaveLength(0);
    expect(cart.count).toBe(0);
  });
});
