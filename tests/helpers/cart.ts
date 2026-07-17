import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Add first in-stock product (qty 1) via API using page session cookies */
export async function addFirstInStockViaApi(page: Page, quantity = 1) {
  return page.evaluate(async (qty) => {
    const products = await fetch('/api/products', { credentials: 'include' }).then((r) => r.json());
    const buy = (products as { id: number; stock: number; name: string }[]).find((x) => x.stock > 0);
    if (!buy) throw new Error('No in-stock product');
    const res = await fetch('/api/cart/items', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: buy.id, quantity: qty }),
    });
    if (!res.ok) throw new Error(`add cart failed: ${res.status}`);
    return { id: buy.id, name: buy.name };
  }, quantity);
}

/** Click first enabled 加入購物車 on product list; returns product name */
export async function addFirstInStockViaUi(page: Page) {
  await page.goto('/');
  await expect(page.locator('.product-card').first()).toBeVisible();
  const card = page
    .locator('.product-card')
    .filter({ has: page.getByRole('button', { name: '加入購物車', disabled: false }) })
    .first();
  const name = (await card.locator('.product-name').innerText()).trim();
  await card.getByRole('button', { name: '加入購物車' }).click();
  await expect(page.getByRole('status')).toContainText('已加入購物車');
  return name;
}
