import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { addFirstInStockViaApi } from './cart';
import { clearCartViaApi } from './auth';
import {
  fillCheckoutShipping,
  goCheckoutFromCart,
  submitCheckout,
  type ShippingInfo,
} from './checkout';

/** Day-0 A.4 statuses newest → oldest (ids roll with server D0 date). */
export const SEED_ORDER_STATUSES = ['待出貨', '已完成', '已出貨'] as const;

/**
 * Day-0 seed order ids (newest → oldest), filled by `resetEnv` / `loadDay0SeedOrders`.
 * Do not hardcode MM-YYYYMMDD — appendix A.4 dates are relative to D0.
 */
export let SEED_ORDER_IDS: string[] = [];

export function seedPendingId() {
  return requireSeeds()[0];
}
export function seedCompletedId() {
  return requireSeeds()[1];
}
export function seedShippedId() {
  return requireSeeds()[2];
}

function requireSeeds(): string[] {
  if (SEED_ORDER_IDS.length !== 3) {
    throw new Error(
      'Day-0 SEED_ORDER_IDS not loaded. Call resetEnv() in beforeAll before using seed ids.',
    );
  }
  return SEED_ORDER_IDS;
}

/** Load / validate A.4 seeds after reset; updates SEED_ORDER_IDS (newest → oldest). */
export async function loadDay0SeedOrders(request: APIRequestContext): Promise<string[]> {
  const ordersRes = await request.get('/api/orders');
  if (!ordersRes.ok()) {
    throw new Error(`loadDay0SeedOrders: GET /api/orders failed: ${ordersRes.status()}`);
  }
  const orders = (await ordersRes.json()) as { id: string; status: string }[];

  // v2.1 API may return oldest→newest; normalize by id (MM-YYYYMMDD-…) descending = newest first
  const sorted = [...orders].sort((a, b) => b.id.localeCompare(a.id));
  const ids = sorted.map((o) => o.id);
  const statuses = sorted.map((o) => o.status);

  const idOk = ids.length === 3 && ids.every((id) => /^MM-\d{8}-\d{4}$/.test(id));
  const statusOk =
    statuses.length === 3 && SEED_ORDER_STATUSES.every((s, i) => statuses[i] === s);

  if (!idOk || !statusOk) {
    throw new Error(
      [
        'Day-0 seed orders invalid after reset.',
        `Expected 3 orders statuses (newest→oldest): ${SEED_ORDER_STATUSES.join(' → ')}`,
        `Actual (normalized) statuses: ${statuses.join(' → ') || '(none)'}`,
        `Actual ids: ${ids.join(', ') || '(none)'}`,
        `Raw API order: ${orders.map((o) => `${o.id}/${o.status}`).join(', ') || '(none)'}`,
      ].join('\n'),
    );
  }

  SEED_ORDER_IDS = ids;
  return ids;
}

/** Order ids for the logged-in session (newest first per API). */
export async function fetchOrderIds(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const res = await fetch('/api/orders', { credentials: 'include' });
    if (!res.ok) throw new Error(`GET /api/orders failed: ${res.status}`);
    const orders = (await res.json()) as { id: string }[];
    return orders.map((o) => o.id);
  });
}

/** Open order detail by id */
export async function openOrderDetail(page: Page, orderId: string) {
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible();
  await expect(page.getByText(orderId)).toBeVisible();
}

/** Place one in-stock item order and open its detail page; returns order id */
export async function placeOrderAndOpenDetail(
  page: Page,
  shipping?: ShippingInfo,
  note?: string,
): Promise<string> {
  await clearCartViaApi(page);
  await addFirstInStockViaApi(page);
  await goCheckoutFromCart(page);
  await fillCheckoutShipping(page, shipping);
  if (note !== undefined) {
    await fillCheckoutNote(page, note);
  }
  await submitCheckout(page);

  const match = page.url().match(/MM-\d{8}-\d{4}/);
  if (!match) throw new Error(`No order id in URL: ${page.url()}`);
  const orderId = match[0];

  await page.getByRole('button', { name: '查看訂單' }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
  await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible();
  return orderId;
}

/** Fill order note on checkout (R-12.12). */
export async function fillCheckoutNote(page: Page, note: string) {
  const field = page.locator('#checkout-note');
  await expect(field).toBeVisible({ timeout: 15_000 });
  await field.fill(note);
}

/** Read status from detail page body near label */
export async function getDetailStatusText(page: Page): Promise<string> {
  const main = await page.locator('main').innerText();
  if (main.includes('載入中')) return '';
  const m = main.match(/訂單狀態\s*\n?\s*(待出貨|已出貨|已完成|已取消|退貨中|已退款)/);
  return m?.[1] ?? '';
}
