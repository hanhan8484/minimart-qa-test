import { test, expect } from '@playwright/test';
import { loginViaApi, resetEnv } from '../helpers';
import {
  addCartItem,
  checkoutViaApi,
  clearCartRequest,
  DEFAULT_API_SHIPPING,
  getProducts,
} from '../helpers/apiCart';

/**
 * Batch API-A — C-A05 / C-A06 checkout side effects
 */
test.describe('C-A05 / C-A06 checkout effects', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('C-A05: order marks coupon used and clears cart', async ({ request }) => {
    test.setTimeout(60_000);
    await loginViaApi(request);
    await clearCartRequest(request);

    const products = await getProducts(request);
    const coffee = products.find((p) => p.name === '手沖咖啡濾杯')!;
    await addCartItem(request, coffee.id, 1);
    const res = await checkoutViaApi(request, {
      ...DEFAULT_API_SHIPPING,
      couponCode: 'NEWBIE20',
    });
    expect(res.status()).toBe(201);
    const { orderId } = await res.json();
    expect(orderId).toMatch(/^MM-\d{8}-\d{4}$/);

    const coupons = await (await request.get('/api/coupons')).json();
    const newbie = coupons.find((c: { code: string }) => c.code === 'NEWBIE20');
    expect(newbie.status).toBe('已使用');
    expect(newbie.usedByOrderId).toBe(orderId);

    const cart = await (await request.get('/api/cart')).json();
    expect(cart.count ?? cart.items?.length ?? 0).toBe(0);
  });

  test('C-A05: order deducts product stock', async ({ request }) => {
    test.fail(true, 'DEF-012: 下單成功後商品庫存未扣減（R-3.5）');
    await loginViaApi(request);
    await clearCartRequest(request);

    const products = await getProducts(request);
    const bottle = products.find((p) => p.name === '不鏽鋼保溫瓶')!;
    const before = bottle.stock;
    await addCartItem(request, bottle.id, 2);
    const res = await checkoutViaApi(request, DEFAULT_API_SHIPPING);
    expect(res.status()).toBe(201);

    const after = await getProducts(request);
    expect(after.find((p) => p.id === bottle.id)!.stock).toBe(before - 2);
  });

  test('C-A06: checkout with qty > stock fails; cart and coupon unchanged', async ({
    request,
  }) => {
    test.setTimeout(90_000);
    const login = await loginViaApi(request);
    expect(login.ok(), `POST /api/auth/login: ${login.status()}`).toBeTruthy();
    await clearCartRequest(request);

    const products = await getProducts(request);
    const mug = products.find((p) => p.name === '陶瓷馬克杯')!;
    expect(mug.stock).toBe(0);

    // Black-box setup: current SUT permits this invalid cart state (DEF-028).
    // Once DEF-028 is fixed, a dedicated stale-cart fixture is required to
    // keep exercising checkout's independent R-3.4 defense.
    const addSoldOut = await request.post('/api/cart/items', {
      data: { productId: mug.id, quantity: 1 },
    });
    test.skip(
      !addSoldOut.ok(),
      'Sold-out add is now blocked; C-A06 needs a stale-cart fixture to reach checkout validation',
    );

    const cartBeforeRes = await request.get('/api/cart');
    expect(cartBeforeRes.ok()).toBeTruthy();
    const cartBefore = await cartBeforeRes.json();
    const cartLinesBefore = (cartBefore.items ?? []).map(
      (item: { productId: number; quantity: number }) => ({
        productId: item.productId,
        quantity: item.quantity,
      }),
    );
    test.skip(
      !cartLinesBefore.some(
        (item: { productId: number; quantity: number }) =>
          item.productId === mug.id && item.quantity === 1,
      ),
      'Unable to establish sold-out mug ×1 in cart; C-A06 needs a stale-cart fixture',
    );

    const ordersBeforeRes = await request.get('/api/orders');
    expect(ordersBeforeRes.ok()).toBeTruthy();
    const orderIdsBefore = ((await ordersBeforeRes.json()) as { id: string }[]).map((o) => o.id);

    const couponsBeforeRes = await request.get('/api/coupons');
    expect(couponsBeforeRes.ok()).toBeTruthy();
    const couponsBefore = await couponsBeforeRes.json();
    const freeshipBefore = couponsBefore.find((c: { code: string }) => c.code === 'FREESHIP');

    const fail = await checkoutViaApi(request, {
      ...DEFAULT_API_SHIPPING,
      couponCode: 'FREESHIP',
    });
    expect(fail.status()).toBe(409);
    expect(await fail.json()).toMatchObject({
      error: 'OUT_OF_STOCK',
      productName: '陶瓷馬克杯',
      remaining: 0,
      message: '商品〈陶瓷馬克杯〉庫存不足，目前僅剩 0 件',
    });

    const ordersAfterRes = await request.get('/api/orders');
    expect(ordersAfterRes.ok()).toBeTruthy();
    const orderIdsAfter = ((await ordersAfterRes.json()) as { id: string }[]).map((o) => o.id);
    expect(orderIdsAfter).toEqual(orderIdsBefore);

    const cartAfterRes = await request.get('/api/cart');
    expect(cartAfterRes.ok()).toBeTruthy();
    const cartAfter = await cartAfterRes.json();
    const cartLinesAfter = (cartAfter.items ?? []).map(
      (item: { productId: number; quantity: number }) => ({
        productId: item.productId,
        quantity: item.quantity,
      }),
    );
    expect(cartLinesAfter).toEqual(cartLinesBefore);
    expect(cartAfter.count).toBe(cartBefore.count);

    const productsAfter = await getProducts(request);
    expect(productsAfter.find((p) => p.id === mug.id)!.stock).toBe(0);

    const couponsAfterRes = await request.get('/api/coupons');
    expect(couponsAfterRes.ok()).toBeTruthy();
    const couponsAfter = await couponsAfterRes.json();
    const freeshipAfter = couponsAfter.find((c: { code: string }) => c.code === 'FREESHIP');
    test.fail(
      true,
      'DEF-029: OUT_OF_STOCK checkout returns 409 but still consumes FREESHIP (R-3.4 / R-12.10)',
    );
    expect.soft(freeshipAfter.status).toBe(freeshipBefore.status);
    expect.soft(freeshipAfter.usedByOrderId).toBe(freeshipBefore.usedByOrderId);
  });
});
