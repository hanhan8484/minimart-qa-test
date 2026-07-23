import type { Page, APIRequestContext } from '@playwright/test';
import type { CartLine, PricingCase, PricingExpect } from '../fixtures/pricing-cases';

type Product = { id: number; name: string; unitPrice: number; stock: number };

export async function fetchProducts(pageOrRequest: Page | APIRequestContext): Promise<Product[]> {
  if ('evaluate' in pageOrRequest) {
    return pageOrRequest.evaluate(async () => {
      const r = await fetch('/api/products', { credentials: 'include' });
      if (!r.ok) throw new Error(`products ${r.status}`);
      return r.json();
    });
  }
  const r = await pageOrRequest.get('/api/products');
  if (!r.ok()) throw new Error(`products ${r.status()}`);
  return r.json();
}

/** Clear cart then add lines by product name (session cookies on page or request). */
export async function setCartLines(
  pageOrRequest: Page | APIRequestContext,
  lines: CartLine[],
) {
  const products = await fetchProducts(pageOrRequest);
  const resolved = lines.map((line) => {
    const p = products.find((x) => x.name === line.productName);
    if (!p) throw new Error(`Product not found: ${line.productName}`);
    return { productId: p.id, quantity: line.quantity };
  });

  if ('evaluate' in pageOrRequest) {
    await pageOrRequest.evaluate(async (items) => {
      const cartResponse = await fetch('/api/cart', { credentials: 'include' });
      if (!cartResponse.ok) throw new Error(`load cart failed ${cartResponse.status}`);
      const cart = await cartResponse.json();
      for (const item of cart.items || []) {
        const del = await fetch(`/api/cart/items/${item.productId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!del.ok) throw new Error(`clear cart item failed ${del.status}`);
      }
      for (const it of items) {
        const res = await fetch('/api/cart/items', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(it),
        });
        if (!res.ok) throw new Error(`add cart failed ${res.status}`);
      }
    }, resolved);
    return;
  }

  const cartRes = await pageOrRequest.get('/api/cart');
  if (!cartRes.ok()) throw new Error(`load cart failed ${cartRes.status()}`);
  const cart = await cartRes.json();
  for (const item of cart.items || []) {
    const del = await pageOrRequest.delete(`/api/cart/items/${item.productId}`);
    if (!del.ok()) throw new Error(`clear cart item failed ${del.status()}`);
  }
  for (const it of resolved) {
    const res = await pageOrRequest.post('/api/cart/items', { data: it });
    if (!res.ok()) throw new Error(`add cart failed ${res.status()}`);
  }
}

export async function previewCheckout(
  pageOrRequest: Page | APIRequestContext,
  couponCode: string | null,
): Promise<PricingExpect & { couponName: string | null }> {
  const body = couponCode ? { couponCode } : {};

  if ('evaluate' in pageOrRequest) {
    return pageOrRequest.evaluate(async (b) => {
      const r = await fetch('/api/checkout/preview', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
      });
      if (!r.ok) throw new Error(`preview ${r.status}`);
      return r.json();
    }, body);
  }

  const r = await pageOrRequest.post('/api/checkout/preview', { data: body });
  if (!r.ok()) throw new Error(`preview ${r.status()}`);
  return r.json();
}

export async function applyPricingCaseCart(
  pageOrRequest: Page | APIRequestContext,
  pricingCase: PricingCase,
) {
  await setCartLines(pageOrRequest, pricingCase.cart);
}

/** Read checkout summary row value by label (data-testid pairs). */
export async function getSummaryValueByLabel(page: Page, label: string): Promise<string> {
  const labels = page.locator('[data-testid="summary-row-label"]');
  const count = await labels.count();
  for (let i = 0; i < count; i++) {
    const text = (await labels.nth(i).innerText()).trim();
    if (text === label) {
      return (await page.locator('[data-testid="summary-row-value"]').nth(i).innerText()).trim();
    }
  }
  throw new Error(`Summary label not found: ${label}`);
}

/**
 * True only for the classic DEF-004 pattern: 滿額折扣 / 優惠券折抵 values are swapped.
 * Other mismatches (extra coupon-name text, wrong shipping, etc.) must stay unexpected.
 */
export function looksLikeDef004DiscountSwap(
  bulkShown: string,
  couponShown: string,
  expectedBulk: string,
  expectedCoupon: string,
): boolean {
  if (expectedBulk === expectedCoupon) return false;
  return bulkShown === expectedCoupon && couponShown === expectedBulk;
}
