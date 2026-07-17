import { expect, type Page } from '@playwright/test';
import { addFirstInStockViaApi } from './cart';
import { clearCartViaApi } from './auth';
import {
  fillCheckoutShipping,
  goCheckoutFromCart,
  submitCheckout,
  type ShippingInfo,
} from './checkout';

/** Day-0 seed order ids (A.4), newest → oldest on list */
export const SEED_ORDER_IDS = [
  'MM-20260712-0001', // 待出貨
  'MM-20260711-0001', // 已完成
  'MM-20260710-0001', // 已出貨
] as const;

export const SEED_ORDER_STATUSES = ['待出貨', '已完成', '已出貨'] as const;

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
): Promise<string> {
  await clearCartViaApi(page);
  await addFirstInStockViaApi(page);
  await goCheckoutFromCart(page);
  await fillCheckoutShipping(page, shipping);
  await submitCheckout(page);

  const match = page.url().match(/MM-\d{8}-\d{4}/);
  if (!match) throw new Error(`No order id in URL: ${page.url()}`);
  const orderId = match[0];

  await page.getByRole('button', { name: '查看訂單' }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
  await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible();
  return orderId;
}

/** Read status from detail page body near label */
export async function getDetailStatusText(page: Page): Promise<string> {
  const main = await page.locator('main').innerText();
  if (main.includes('載入中')) return '';
  const m = main.match(/訂單狀態\s*\n?\s*(待出貨|已出貨|已完成|已取消|退貨中|已退款)/);
  return m?.[1] ?? '';
}
