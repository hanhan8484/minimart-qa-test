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
 * Batch API-A — N-A01 notification create + order-confirm structure
 */
test.describe('N-A01 notifications API', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('new order appends ORDER_CONFIRMED with 4-part body matching order', async ({
    request,
  }) => {
    test.setTimeout(60_000);
    await loginViaApi(request);

    const before = await (await request.get('/api/notifications')).json();
    const beforeCount = before.length;
    const beforeIds = new Set(before.map((n: { id: number }) => n.id));

    await clearCartRequest(request);
    const products = await getProducts(request);
    const coffee = products.find((p) => p.name === '手沖咖啡濾杯')!;
    const candle = products.find((p) => p.name === '香氛蠟燭禮盒')!;
    await addCartItem(request, coffee.id, 1);
    await addCartItem(request, candle.id, 1);

    const shipping = {
      ...DEFAULT_API_SHIPPING,
      recipientName: '通知測試收件',
    };
    const co = await checkoutViaApi(request, shipping);
    expect(co.status()).toBe(201);
    const { orderId } = await co.json();
    const order = await (await request.get(`/api/orders/${orderId}`)).json();

    const after = await (await request.get('/api/notifications')).json();
    expect(after.length).toBe(beforeCount + 1);

    const created = after.filter((n: { id: number }) => !beforeIds.has(n.id));
    expect(created).toHaveLength(1);
    const n = created[0];
    expect(n.type).toBe('ORDER_CONFIRMED');
    expect(n.orderId).toBe(orderId);
    expect(n.title).toBe(`訂單 ${orderId} 已成立`);
    expect(n.read).toBe(false);

    // R-8.2 four parts; R-15.7 line count === item count
    test.fail(
      true,
      'DEF-015: 下單確認通知 body 未對應該筆訂單（錯用其他訂單內容）（R-8.2／R-15.7）',
    );
    const lines = String(n.body).split('\n');
    expect(lines[0]).toMatch(/^下單時間 /);
    expect(lines[0]).toContain(order.createdAt);
    // item lines
    const itemLines = lines.filter((l: string) => /×\s*\d+/.test(l));
    expect(itemLines).toHaveLength(order.items.length);
    for (const item of order.items) {
      expect(n.body).toContain(`${item.name} × ${item.quantity}`);
    }
    expect(n.body).toContain(`應付金額 NT$`);
    expect(n.body).toContain(`收件人 ${shipping.recipientName}`);
  });
});
