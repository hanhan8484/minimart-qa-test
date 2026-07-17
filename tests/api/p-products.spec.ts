import { test, expect } from '@playwright/test';
import { loginViaApi, resetEnv, PRODUCT_ORDER, SOLD_OUT_PRODUCT } from '../helpers';
import { addCartItem, clearCartRequest, getProducts } from '../helpers/apiCart';

/** A.1 Day-0 unit prices */
const A1_PRICES: Record<string, number> = {
  手沖咖啡濾杯: 480,
  不鏽鋼保溫瓶: 690,
  極簡皮革錢包: 1280,
  無線藍牙耳機: 2150,
  '純棉素色 T 恤': 400,
  陶瓷馬克杯: 260,
  折疊露營椅: 1020,
  香氛蠟燭禮盒: 860,
  機械式鍵盤: 3180,
};

const A1_STOCK: Record<string, number> = {
  手沖咖啡濾杯: 12,
  不鏽鋼保溫瓶: 8,
  極簡皮革錢包: 5,
  無線藍牙耳機: 3,
  '純棉素色 T 恤': 20,
  陶瓷馬克杯: 0,
  折疊露營椅: 1,
  香氛蠟燭禮盒: 6,
  機械式鍵盤: 4,
};

/**
 * Batch API-A — P-A01 / P-A02
 */
test.describe('P-A01 / P-A02 products API', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ request }) => {
    await loginViaApi(request);
  });

  test('P-A01: products match A.1 names, prices, stock integers', async ({ request }) => {
    const products = await getProducts(request);
    expect(products).toHaveLength(PRODUCT_ORDER.length);

    const byName = Object.fromEntries(products.map((p) => [p.name, p]));
    for (const name of PRODUCT_ORDER) {
      const p = byName[name];
      expect(p, name).toBeTruthy();
      expect(Number.isInteger(p.stock)).toBeTruthy();
      expect(p.stock).toBeGreaterThanOrEqual(0);
      expect(p.unitPrice).toBe(A1_PRICES[name]);
      expect(p.stock).toBe(A1_STOCK[name]);
    }
    expect(byName[SOLD_OUT_PRODUCT].stock).toBe(0);
  });

  test('P-A02: add to cart does not change stock', async ({ request }) => {
    const before = await getProducts(request);
    const coffee = before.find((p) => p.name === '手沖咖啡濾杯')!;
    await clearCartRequest(request);
    await addCartItem(request, coffee.id, 2);
    const after = await getProducts(request);
    expect(after.find((p) => p.id === coffee.id)!.stock).toBe(coffee.stock);
  });
});
