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
    test.fail(
      true,
      'DEF-012/DEF-013: 庫存未扣減且庫存不足仍可下單（R-3.4／R-3.5）',
    );

    await loginViaApi(request);
    await clearCartRequest(request);

    const products = await getProducts(request);
    const chair = products.find((p) => p.name === '折疊露營椅')!;
    expect(chair.stock).toBe(1);

    await addCartItem(request, chair.id, 1);
    const first = await checkoutViaApi(request, DEFAULT_API_SHIPPING);
    expect(first.status()).toBe(201);

    const afterFirst = await getProducts(request);
    expect(afterFirst.find((p) => p.id === chair.id)!.stock).toBe(0);

    await addCartItem(request, chair.id, 1);
    const couponsBefore = await (await request.get('/api/coupons')).json();
    const freeshipBefore = couponsBefore.find((c: { code: string }) => c.code === 'FREESHIP');

    const fail = await checkoutViaApi(request, {
      ...DEFAULT_API_SHIPPING,
      couponCode: 'FREESHIP',
    });
    expect(fail.ok()).toBeFalsy();

    const cart = await (await request.get('/api/cart')).json();
    expect(cart.items?.length ?? 0).toBeGreaterThan(0);

    const couponsAfter = await (await request.get('/api/coupons')).json();
    const freeshipAfter = couponsAfter.find((c: { code: string }) => c.code === 'FREESHIP');
    expect(freeshipAfter.status).toBe(freeshipBefore.status);
    expect(freeshipAfter.usedByOrderId).toBe(freeshipBefore.usedByOrderId);
  });
});
