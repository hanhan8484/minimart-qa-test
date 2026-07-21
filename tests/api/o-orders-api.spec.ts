import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { loginViaApi, resetEnv, seedCompletedId, seedPendingId, seedShippedId } from '../helpers';
import {
  addCartItem,
  checkoutViaApi,
  clearCartRequest,
  DEFAULT_API_SHIPPING,
  getProducts,
} from '../helpers/apiCart';

type Order = {
  id: string;
  status: string;
  createdAt: string;
  shippedAt?: string | null;
  completedAt?: string | null;
  refundedAt?: string | null;
  returnStatus?: string | null;
  payable: number;
  shipping: number;
  refundAmount?: number | null;
};

type Coupon = {
  code: string;
  status: string;
  usedByOrderId?: string | null;
};

async function expectOk(response: APIResponse, label: string) {
  expect(response.ok(), `${label}: HTTP ${response.status()}`).toBeTruthy();
}

async function getOrder(request: APIRequestContext, orderId: string): Promise<Order> {
  const response = await request.get(`/api/orders/${orderId}`);
  await expectOk(response, `GET /api/orders/${orderId}`);
  return response.json();
}

async function getCoupons(request: APIRequestContext): Promise<Coupon[]> {
  const response = await request.get('/api/coupons');
  await expectOk(response, 'GET /api/coupons');
  return response.json();
}

async function getCoupon(request: APIRequestContext, code: string): Promise<Coupon> {
  const coupon = (await getCoupons(request)).find((item) => item.code === code);
  expect(coupon, `coupon ${code} should exist`).toBeTruthy();
  return coupon!;
}

async function getProduct(request: APIRequestContext, name: string) {
  const product = (await getProducts(request)).find((item) => item.name === name);
  expect(product, `product ${name} should exist`).toBeTruthy();
  return product!;
}

async function createOrder(
  request: APIRequestContext,
  options: {
    productName?: string;
    quantity?: number;
    couponCode?: string;
  } = {},
): Promise<string> {
  await clearCartRequest(request);
  const product = await getProduct(request, options.productName ?? '手沖咖啡濾杯');
  await addCartItem(request, product.id, options.quantity ?? 1);

  const response = await checkoutViaApi(request, {
    ...DEFAULT_API_SHIPPING,
    couponCode: options.couponCode,
  });
  expect(response.status(), 'POST /api/checkout').toBe(201);
  const body = (await response.json()) as { orderId: string };
  expect(body.orderId).toMatch(/^MM-\d{8}-\d{4}$/);
  return body.orderId;
}

async function advanceOrderToRefund(request: APIRequestContext, orderId: string) {
  const ship = await request.post(`/api/orders/${orderId}/ship`);
  await expectOk(ship, `POST /api/orders/${orderId}/ship`);

  const confirm = await request.post(`/api/orders/${orderId}/confirm-receipt`);
  await expectOk(confirm, `POST /api/orders/${orderId}/confirm-receipt`);

  const applyReturn = await request.post(`/api/orders/${orderId}/returns`, {
    data: { reason: '商品有瑕疵需要退貨' },
  });
  await expectOk(applyReturn, `POST /api/orders/${orderId}/returns`);

  const review = await request.post(`/api/orders/${orderId}/returns/review`);
  await expectOk(review, `POST /api/orders/${orderId}/returns/review`);

  const refunded = await getOrder(request, orderId);
  expect(refunded.status).toBe('已退款');
  return refunded;
}

function transitionSnapshot(order: Order) {
  return {
    status: order.status,
    shippedAt: order.shippedAt ?? null,
    completedAt: order.completedAt ?? null,
    refundedAt: order.refundedAt ?? null,
    returnStatus: order.returnStatus ?? null,
  };
}

/**
 * Batch API-A — O-A01～O-A05 order APIs
 */
test.describe('O-A01～O-A05 orders API', () => {
  test.beforeEach(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
    const login = await loginViaApi(request);
    await expectOk(login, 'POST /api/auth/login');
    await clearCartRequest(request);
  });

  test('O-A01: id date matches createdAt and same-day sequence increments', async ({
    request,
  }) => {
    const firstId = await createOrder(request);
    const first = await getOrder(request, firstId);
    expect(first.id).toBe(firstId);

    const secondId = await createOrder(request);
    const second = await getOrder(request, secondId);

    const [, firstDate, firstSequence] = firstId.split('-');
    const [, secondDate, secondSequence] = secondId.split('-');
    expect(firstDate).toBe(first.createdAt.slice(0, 10).replace(/-/g, ''));
    expect(secondDate).toBe(second.createdAt.slice(0, 10).replace(/-/g, ''));
    expect(Number(firstSequence)).toBe(1);
    expect(Number(secondSequence)).toBe(Number(firstSequence) + 1);
  });

  const illegalTransitions = [
    {
      name: 'shipping an already-shipped order',
      orderId: seedShippedId,
      endpoint: 'ship',
    },
    {
      name: 'shipping a completed order',
      orderId: seedCompletedId,
      endpoint: 'ship',
    },
    {
      name: 'confirming receipt for a pending order',
      orderId: seedPendingId,
      endpoint: 'confirm-receipt',
    },
  ];

  for (const scenario of illegalTransitions) {
    test(`O-A02: ${scenario.name} leaves order unchanged`, async ({ request }) => {
      const orderId = scenario.orderId();
      const before = await getOrder(request, orderId);
      const response = await request.post(`/api/orders/${orderId}/${scenario.endpoint}`);
      expect(response.status()).toBeLessThan(500);
      const after = await getOrder(request, orderId);
      expect(transitionSnapshot(after)).toEqual(transitionSnapshot(before));
    });
  }

  test('O-A03: cart, ship, confirm and return request do not change stock', async ({
    request,
  }) => {
    const coffee = await getProduct(request, '手沖咖啡濾杯');
    const initialStock = coffee.stock;

    await addCartItem(request, coffee.id, 1);
    expect((await getProduct(request, coffee.name)).stock).toBe(initialStock);

    const checkout = await checkoutViaApi(request, DEFAULT_API_SHIPPING);
    expect(checkout.status(), 'POST /api/checkout').toBe(201);
    const { orderId } = (await checkout.json()) as { orderId: string };
    const stockAfterCheckout = (await getProduct(request, coffee.name)).stock;

    const ship = await request.post(`/api/orders/${orderId}/ship`);
    await expectOk(ship, `POST /api/orders/${orderId}/ship`);
    expect((await getProduct(request, coffee.name)).stock).toBe(stockAfterCheckout);

    const confirm = await request.post(`/api/orders/${orderId}/confirm-receipt`);
    await expectOk(confirm, `POST /api/orders/${orderId}/confirm-receipt`);
    expect((await getProduct(request, coffee.name)).stock).toBe(stockAfterCheckout);

    const applyReturn = await request.post(`/api/orders/${orderId}/returns`, {
      data: { reason: '商品有瑕疵需要退貨' },
    });
    await expectOk(applyReturn, `POST /api/orders/${orderId}/returns`);
    expect((await getProduct(request, coffee.name)).stock).toBe(stockAfterCheckout);
  });

  test('O-A03: cancellation restores deducted stock', async ({ request }) => {
    const coffee = await getProduct(request, '手沖咖啡濾杯');
    const before = coffee.stock;
    const orderId = await createOrder(request, { quantity: 2 });
    const afterCheckout = (await getProduct(request, coffee.name)).stock;

    test.skip(
      afterCheckout !== before - 2,
      'Blocked by DEF-012: checkout did not deduct stock, so cancellation restoration has no valid baseline',
    );

    const cancel = await request.post(`/api/orders/${orderId}/cancel`);
    if (!cancel.ok()) {
      test.fail(true, 'DEF-003: new pending order has no working cancel API (R-6.5)');
      expect(cancel.ok(), `POST cancel: HTTP ${cancel.status()}`).toBeTruthy();
      return;
    }

    expect((await getOrder(request, orderId)).status).toBe('已取消');
    expect((await getProduct(request, coffee.name)).stock).toBe(before);
  });

  test('O-A03: completed refund restores deducted stock', async ({ request }) => {
    const coffee = await getProduct(request, '手沖咖啡濾杯');
    const before = coffee.stock;
    const orderId = await createOrder(request, { quantity: 2 });
    const afterCheckout = (await getProduct(request, coffee.name)).stock;

    test.skip(
      afterCheckout !== before - 2,
      'Blocked by DEF-012: checkout did not deduct stock, so refund restoration has no valid baseline',
    );

    await advanceOrderToRefund(request, orderId);
    expect((await getProduct(request, coffee.name)).stock).toBe(before);
  });

  test('O-A04: paid-shipping refund equals payable minus shipping', async ({ request }) => {
    const orderId = await createOrder(request, { quantity: 1 });
    const order = await advanceOrderToRefund(request, orderId);
    expect(order.shipping).toBeGreaterThan(0);

    test.fail(true, 'DEF-006: refundAmount ≠ payable−shipping（R-7.10）');
    expect(order.refundAmount).toBe(order.payable - order.shipping);
  });

  test('O-A04: free-shipping refund equals full payable', async ({ request }) => {
    const orderId = await createOrder(request, { quantity: 5 });
    const order = await advanceOrderToRefund(request, orderId);
    expect(order.shipping).toBe(0);

    test.fail(true, 'DEF-006: zero-shipping refund returns subtotal instead of payable（R-7.10）');
    expect(order.refundAmount).toBe(order.payable);
  });

  test('O-A05: past-due fixture coupon is expired', async ({ request }) => {
    const expired = await getCoupon(request, 'EXPIRED50');
    expect(expired.status).toBe('已過期');
  });

  test('O-A05: refund returns used coupon to unused', async ({ request }) => {
    const orderId = await createOrder(request, { couponCode: 'FREESHIP' });
    const used = await getCoupon(request, 'FREESHIP');
    expect(used.status).toBe('已使用');
    expect(used.usedByOrderId).toBe(orderId);

    await advanceOrderToRefund(request, orderId);
    const returned = await getCoupon(request, 'FREESHIP');
    expect(returned.status).toBe('未使用');
    expect(returned.usedByOrderId).toBeNull();
  });

  test('O-A05: cancellation returns used coupon to unused', async ({ request }) => {
    const orderId = await createOrder(request, { couponCode: 'FREESHIP' });
    const used = await getCoupon(request, 'FREESHIP');
    expect(used.status).toBe('已使用');
    expect(used.usedByOrderId).toBe(orderId);

    const cancel = await request.post(`/api/orders/${orderId}/cancel`);
    if (!cancel.ok()) {
      test.fail(true, 'DEF-003: new pending order has no working cancel API (R-6.5 / R-4.13)');
      expect(cancel.ok(), `POST cancel: HTTP ${cancel.status()}`).toBeTruthy();
      return;
    }

    expect((await getOrder(request, orderId)).status).toBe('已取消');
    const returned = await getCoupon(request, 'FREESHIP');
    expect(returned.status).toBe('未使用');
    expect(returned.usedByOrderId).toBeNull();
  });
});
