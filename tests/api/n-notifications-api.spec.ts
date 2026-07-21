import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { loginViaApi, resetEnv, seedCompletedId } from '../helpers';
import {
  addCartItem,
  checkoutViaApi,
  clearCartRequest,
  DEFAULT_API_SHIPPING,
  getProducts,
} from '../helpers/apiCart';

type NotificationType =
  | 'ORDER_CONFIRMED'
  | 'SHIPPED'
  | 'RETURN_RECEIVED'
  | 'RETURN_APPROVED'
  | 'RETURN_REJECTED'
  | 'REFUND_COMPLETED';

type Notification = {
  id: number;
  type: NotificationType;
  orderId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

type Order = {
  id: string;
  createdAt: string;
  payable: number;
  items: { name: string; quantity: number }[];
};

async function expectOk(response: APIResponse, label: string) {
  expect(response.ok(), `${label}: HTTP ${response.status()}`).toBeTruthy();
}

async function getNotifications(request: APIRequestContext): Promise<Notification[]> {
  const response = await request.get('/api/notifications');
  await expectOk(response, 'GET /api/notifications');
  return response.json();
}

async function getOrder(request: APIRequestContext, orderId: string): Promise<Order> {
  const response = await request.get(`/api/orders/${orderId}`);
  await expectOk(response, `GET /api/orders/${orderId}`);
  return response.json();
}

function ids(notifications: Notification[]) {
  return notifications.map((notification) => notification.id).sort((a, b) => a - b);
}

function expectCreatedNotifications(
  before: Notification[],
  after: Notification[],
  expectedTypes: NotificationType[],
  orderId: string,
) {
  expect(after).toHaveLength(before.length + expectedTypes.length);

  const beforeIds = new Set(before.map((notification) => notification.id));
  for (const notification of before) {
    expect(after.some((current) => current.id === notification.id)).toBeTruthy();
  }

  const created = after.filter((notification) => !beforeIds.has(notification.id));
  expect(created.map((notification) => notification.type).sort()).toEqual(
    [...expectedTypes].sort(),
  );
  for (const notification of created) {
    expect(notification.orderId).toBe(orderId);
    expect(notification.read).toBe(false);
  }
  return created;
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US');
}

/**
 * Batch API-A — N-A01 five notification categories + order-confirm structure
 */
test.describe('N-A01 notifications API', () => {
  test.beforeEach(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
    const login = await loginViaApi(request);
    await expectOk(login, 'POST /api/auth/login');
    await clearCartRequest(request);
  });

  test('ORDER_CONFIRMED appends exact four-part body for its own order', async ({
    request,
  }) => {
    test.setTimeout(60_000);
    const before = await getNotifications(request);

    const products = await getProducts(request);
    const coffee = products.find((product) => product.name === '手沖咖啡濾杯');
    const candle = products.find((product) => product.name === '香氛蠟燭禮盒');
    expect(coffee).toBeTruthy();
    expect(candle).toBeTruthy();
    if (!coffee || !candle) throw new Error('Required notification test products are missing');
    await addCartItem(request, coffee.id, 1);
    await addCartItem(request, candle.id, 1);

    const note = '通知內文不應出現這段訂單備註';
    const shipping = {
      ...DEFAULT_API_SHIPPING,
      recipientName: '通知測試收件',
    };
    const checkout = await checkoutViaApi(request, { ...shipping, note });
    expect(checkout.status(), 'POST /api/checkout').toBe(201);
    const { orderId } = (await checkout.json()) as { orderId: string };
    const order = await getOrder(request, orderId);

    const after = await getNotifications(request);
    const [created] = expectCreatedNotifications(before, after, ['ORDER_CONFIRMED'], orderId);
    expect(created.title).toBe(`訂單 ${orderId} 已成立`);

    const expectedBody = [
      `下單時間 ${order.createdAt.slice(0, 16)}`,
      ...order.items.map((item) => `${item.name} × ${item.quantity}`),
      `應付金額 NT$${formatCurrency(order.payable)}`,
      `收件人 ${shipping.recipientName}`,
    ].join('\n');

    test.fail(
      true,
      'DEF-015: 下單確認通知 body 未對應該筆訂單（錯用其他訂單內容）（R-8.2／R-15.7）',
    );
    expect.soft(created.body).toBe(expectedBody);
    expect.soft(created.body).not.toContain(note);
  });

  test('five event categories append independently without overwrite or merge', async ({
    request,
  }) => {
    test.setTimeout(90_000);
    const initial = await getNotifications(request);
    const coffee = (await getProducts(request)).find(
      (product) => product.name === '手沖咖啡濾杯',
    );
    expect(coffee).toBeTruthy();
    if (!coffee) throw new Error('Required notification test product is missing');
    await addCartItem(request, coffee.id, 1);

    const checkout = await checkoutViaApi(request, DEFAULT_API_SHIPPING);
    expect(checkout.status(), 'POST /api/checkout').toBe(201);
    const { orderId } = (await checkout.json()) as { orderId: string };

    const afterCheckout = await getNotifications(request);
    const [confirmed] = expectCreatedNotifications(
      initial,
      afterCheckout,
      ['ORDER_CONFIRMED'],
      orderId,
    );
    expect(confirmed.title).toBe(`訂單 ${orderId} 已成立`);

    const ship = await request.post(`/api/orders/${orderId}/ship`);
    await expectOk(ship, `POST /api/orders/${orderId}/ship`);
    const afterShip = await getNotifications(request);
    const [shipped] = expectCreatedNotifications(afterCheckout, afterShip, ['SHIPPED'], orderId);
    expect(shipped.title).toBe(`訂單 ${orderId} 已出貨`);
    expect(shipped.body).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    const confirm = await request.post(`/api/orders/${orderId}/confirm-receipt`);
    await expectOk(confirm, `POST /api/orders/${orderId}/confirm-receipt`);
    const afterConfirm = await getNotifications(request);
    expect(ids(afterConfirm)).toEqual(ids(afterShip));

    const reason = '商品有瑕疵需要退貨';
    const applyReturn = await request.post(`/api/orders/${orderId}/returns`, {
      data: { reason },
    });
    await expectOk(applyReturn, `POST /api/orders/${orderId}/returns`);
    const afterReturn = await getNotifications(request);
    const [received] = expectCreatedNotifications(
      afterConfirm,
      afterReturn,
      ['RETURN_RECEIVED'],
      orderId,
    );
    expect(received.title).toBe(`訂單 ${orderId} 的退貨申請已送出`);
    expect(received.body).toMatch(new RegExp(`^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}\\n${reason}$`));

    const review = await request.post(`/api/orders/${orderId}/returns/review`);
    await expectOk(review, `POST /api/orders/${orderId}/returns/review`);
    const afterReview = await getNotifications(request);
    const reviewCreated = expectCreatedNotifications(
      afterReturn,
      afterReview,
      ['RETURN_APPROVED', 'REFUND_COMPLETED'],
      orderId,
    );
    expect(reviewCreated.find((notification) => notification.type === 'RETURN_APPROVED')?.title).toBe(
      `訂單 ${orderId} 的退貨申請已通過`,
    );
    expect(
      reviewCreated.find((notification) => notification.type === 'REFUND_COMPLETED')?.title,
    ).toBe(`訂單 ${orderId} 已退款`);

    expect(afterReview).toHaveLength(initial.length + 5);
  });

  test('rejected review appends rejection notification without refund notification', async ({
    request,
  }) => {
    const orderId = seedCompletedId();
    const initial = await getNotifications(request);
    const reason = '短';

    const applyReturn = await request.post(`/api/orders/${orderId}/returns`, {
      data: { reason },
    });
    await expectOk(applyReturn, `POST /api/orders/${orderId}/returns`);
    const afterReturn = await getNotifications(request);
    expectCreatedNotifications(initial, afterReturn, ['RETURN_RECEIVED'], orderId);

    const review = await request.post(`/api/orders/${orderId}/returns/review`);
    await expectOk(review, `POST /api/orders/${orderId}/returns/review`);
    const afterReview = await getNotifications(request);
    const [rejected] = expectCreatedNotifications(
      afterReturn,
      afterReview,
      ['RETURN_REJECTED'],
      orderId,
    );
    expect(rejected.title).toBe(`訂單 ${orderId} 的退貨申請已駁回`);
    expect(rejected.body).toBe('退貨原因描述不足，請補充後重新申請');

    const allCreated = afterReview.filter(
      (notification) => !initial.some((existing) => existing.id === notification.id),
    );
    expect(allCreated.some((notification) => notification.type === 'REFUND_COMPLETED')).toBe(false);
  });
});
