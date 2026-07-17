import { test, expect, type Page } from '@playwright/test';
import {
  clearCartViaApi,
  loginAsDemo,
  PRODUCT_ORDER,
  resetEnv,
  SOLD_OUT_PRODUCT,
} from '../helpers';

const DEF_018_PRODUCT = '香氛蠟燭禮盒';

/** R-9.2: visible <img> is not enough — collect names where decode failed (naturalWidth === 0). */
async function collectBrokenProductImages(page: Page): Promise<string[]> {
  const cards = page.locator('.product-card');
  await expect(cards).toHaveCount(PRODUCT_ORDER.length);

  const broken: string[] = [];
  for (let i = 0; i < PRODUCT_ORDER.length; i++) {
    const card = cards.nth(i);
    await expect(card.locator('.product-name')).toHaveText(PRODUCT_ORDER[i]);
    const img = card.locator('img').first();
    await expect(img).toBeVisible();

    let loaded = false;
    try {
      await expect
        .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth), {
          timeout: 10_000,
        })
        .toBeGreaterThan(0);
      loaded = true;
    } catch {
      loaded = false;
    }

    if (!loaded) {
      broken.push(PRODUCT_ORDER[i]);
    }
  }
  return broken;
}

/**
 * Batch 1 — P product list
 * P-B01: list order & cards
 * P-B02: sold out disabled
 * P-B03: add toast + open detail
 */
test.describe('P-B01 / P-B02 / P-B03 product list', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await clearCartViaApi(page);
    await page.goto('/');
    await expect(page.locator('.product-card').first()).toBeVisible();
  });

  test('P-B01: product order, card fields, no decimal prices', async ({ page }) => {
    const cards = page.locator('.product-card');
    await expect(cards).toHaveCount(PRODUCT_ORDER.length);

    for (let i = 0; i < PRODUCT_ORDER.length; i++) {
      const card = cards.nth(i);
      await expect(card.locator('.product-name')).toHaveText(PRODUCT_ORDER[i]);
      await expect(card.locator('.product-image')).toBeVisible();
      await expect(card.locator('.product-category')).not.toBeEmpty();
      const price = (await card.locator('.product-price').innerText()).trim();
      expect(price).toMatch(/^NT\$[\d,]+$/);
      expect(price).not.toContain('.');
      const stock = (await card.locator('.product-stock').innerText()).trim();
      expect(stock === '已售完' || /^剩餘 \d+ 件$/.test(stock)).toBeTruthy();
    }

    await expect(page.getByPlaceholder(/搜尋|search/i)).toHaveCount(0);
  });

  test('P-B01 / R-9.2: all product card images load (naturalWidth > 0)', async ({ page }) => {
    const broken = await collectBrokenProductImages(page);
    if (broken.length === 1 && broken[0] === DEF_018_PRODUCT) {
      test.fail(
        true,
        'DEF-018: 香氛蠟燭禮盒圖片破圖（/images/candle-gift.svg 回傳 HTML 而非圖片）（R-9.2）',
      );
    }
    expect(broken, `Broken product images: ${broken.join(', ')}`).toEqual([]);
  });

  test('P-B02: sold-out product disables add-to-cart', async ({ page }) => {
    const soldOut = page
      .locator('.product-card')
      .filter({ has: page.locator('.product-name', { hasText: SOLD_OUT_PRODUCT }) });
    await expect(soldOut.locator('.product-stock')).toHaveText('已售完');
    const btn = soldOut.getByRole('button', { name: '加入購物車' });
    await expect(btn).toBeDisabled();
  });

  test('P-B03: add-to-cart toast; click name opens detail', async ({ page }) => {
    const card = page
      .locator('.product-card')
      .filter({ has: page.getByRole('button', { name: '加入購物車', disabled: false }) })
      .first();
    await card.getByRole('button', { name: '加入購物車' }).click();
    await expect(page.getByRole('status')).toContainText('已加入購物車');

    await card.locator('.product-name').click();
    await expect(page).toHaveURL(/\/products\//);
    await expect(page.locator('.product-detail-page, .product-detail-name').first()).toBeVisible();
    await page.getByRole('link', { name: /回商品列表/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
