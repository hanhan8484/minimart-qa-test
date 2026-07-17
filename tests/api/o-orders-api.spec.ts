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
 * Batch API-A — O-A01～O-A05 order APIs
 */
test.describe('O-A01～O-A05 orders API', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('O-A01: new order id matches MM-YYYYMMDD-NNNN', async ({ request }) => {
    await loginViaApi(request);
    await clearCartRequest(request);
    const products = await getProducts(request);
    const coffee = products.find((p) => p.name === '手沖咖啡濾杯')!;
    await addCartItem(request, coffee.id, 1);
    const res = await checkoutViaApi(request, DEFAULT_API_SHIPPING);
    expect(res.status()).toBe(201);
    const { orderId } = await res.json();
    expect(orderId).toMatch(/^MM-\d{8}-\d{4}$/);
    const detail = await (await request.get(`/api/orders/${orderId}`)).json();
    expect(detail.id).toBe(orderId);
  });

  test('O-A02: illegal transitions should be rejected', async ({ request }) => {
    test.fail(
      true,
      'DEF-014: 非法狀態轉換（已出貨再出貨／已完成再出貨）仍回 200（R-6.2／R-6.7／R-6.8）',
    );
    await loginViaApi(request);

    const shipAgain = await request.post('/api/orders/MM-20260710-0001/ship');
    expect(shipAgain.ok()).toBeFalsy();

    const shipCompleted = await request.post('/api/orders/MM-20260711-0001/ship');
    expect(shipCompleted.ok()).toBeFalsy();

    const confirmPending = await request.post('/api/orders/MM-20260712-0001/confirm-receipt');
    expect(confirmPending.status()).toBe(409);
  });

  test('O-A03: cart does not change stock; order should deduct', async ({ request }) => {
    test.setTimeout(60_000);
    await loginViaApi(request);
    await clearCartRequest(request);
    const products = await getProducts(request);
    const coffee = products.find((p) => p.name === '手沖咖啡濾杯')!;
    const before = coffee.stock;

    await addCartItem(request, coffee.id, 2);
    const mid = await getProducts(request);
    expect(mid.find((p) => p.id === coffee.id)!.stock).toBe(before);

    test.fail(true, 'DEF-012: 下單不扣庫存（R-3.5／R-3.7／R-3.8）');
    const co = await checkoutViaApi(request, DEFAULT_API_SHIPPING);
    expect(co.status()).toBe(201);
    const afterOrder = await getProducts(request);
    expect(afterOrder.find((p) => p.id === coffee.id)!.stock).toBe(before - 2);
  });

  test('O-A04: refundAmount === payable − shipping', async ({ request }) => {
    test.setTimeout(90_000);
    test.fail(true, 'DEF-006: refundAmount ≠ payable−shipping（R-7.10）');

    await loginViaApi(request);
    await clearCartRequest(request);
    const products = await getProducts(request);
    const coffee = products.find((p) => p.name === '手沖咖啡濾杯')!;
    await addCartItem(request, coffee.id, 1);
    const co = await checkoutViaApi(request, DEFAULT_API_SHIPPING);
    const { orderId } = await co.json();

    await request.post(`/api/orders/${orderId}/ship`);
    await request.post(`/api/orders/${orderId}/confirm-receipt`);
    await request.post(`/api/orders/${orderId}/returns`, {
      data: { reason: '商品有瑕疵需要退貨' },
    });
    await request.post(`/api/orders/${orderId}/returns/review`);

    const order = await (await request.get(`/api/orders/${orderId}`)).json();
    expect(order.status).toBe('已退款');
    expect(order.refundAmount).toBe(order.payable - order.shipping);
  });

  test('O-A05: EXPIRED50 is 已過期; used coupon returns after refund', async ({ request }) => {
    test.setTimeout(120_000);
    await loginViaApi(request);

    const coupons0 = await (await request.get('/api/coupons')).json();
    const expired = coupons0.find((c: { code: string }) => c.code === 'EXPIRED50');
    expect(expired.status).toBe('已過期');

    await clearCartRequest(request);
    const products = await getProducts(request);
    const coffee = products.find((p) => p.name === '手沖咖啡濾杯')!;
    await addCartItem(request, coffee.id, 1);
    const co = await checkoutViaApi(request, {
      ...DEFAULT_API_SHIPPING,
      couponCode: 'FREESHIP',
    });
    expect(co.status()).toBe(201);
    const { orderId } = await co.json();

    let coupon = (await (await request.get('/api/coupons')).json()).find(
      (c: { code: string }) => c.code === 'FREESHIP',
    );
    expect(coupon.status).toBe('已使用');
    expect(coupon.usedByOrderId).toBe(orderId);

    await request.post(`/api/orders/${orderId}/ship`);
    await request.post(`/api/orders/${orderId}/confirm-receipt`);
    await request.post(`/api/orders/${orderId}/returns`, {
      data: { reason: '商品有瑕疵需要退貨' },
    });
    await request.post(`/api/orders/${orderId}/returns/review`);

    coupon = (await (await request.get('/api/coupons')).json()).find(
      (c: { code: string }) => c.code === 'FREESHIP',
    );
    expect(coupon.status).toBe('未使用');
    expect(coupon.usedByOrderId).toBeNull();
  });
});
