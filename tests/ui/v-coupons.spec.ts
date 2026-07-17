import { test, expect } from '@playwright/test';
import {
  addFirstInStockViaApi,
  clearCartViaApi,
  fillCheckoutShipping,
  goCheckoutFromCart,
  loginAsDemo,
  resetEnv,
  submitCheckout,
} from '../helpers';

/**
 * Batch 8 — V-B01 coupon tabs & cards
 * R-17.5～R-17.9
 */
test.describe.serial('V-B01 coupons page', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('tabs, usable/expired cards, empty used, no apply on page', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsDemo(page);
    await page.goto('/coupons');
    await expect(page.getByRole('heading', { name: '我的優惠券' })).toBeVisible();

    const usableTab = page.locator('.coupons-tab', { hasText: '可使用' });
    const usedTab = page.locator('.coupons-tab', { hasText: '已使用' });
    const expiredTab = page.locator('.coupons-tab', { hasText: '已過期' });

    await expect(usableTab).toHaveText('可使用 (5)');
    await expect(usedTab).toHaveText('已使用 (0)');
    await expect(expiredTab).toHaveText('已過期 (1)');
    await expect(usableTab).toHaveClass(/coupons-tab-active/);

    const cards = page.getByTestId('coupon-card');
    await expect(cards).toHaveCount(5);

    const newbie = cards.filter({ hasText: '新人小禮券' });
    await expect(newbie.locator('.coupon-card-code')).toHaveText('券碼 NEWBIE20');
    await expect(newbie.locator('.coupon-card-value')).toHaveText('NT$20');
    await expect(newbie.locator('.coupon-card-threshold')).toHaveText('無最低消費');
    await expect(newbie.locator('.coupon-card-status')).toHaveText('未使用');
    await expect(newbie.locator('.coupon-card-expires')).toContainText('到期日');

    const save100 = cards.filter({ hasText: '滿千折百券' });
    await expect(save100.locator('.coupon-card-threshold')).toHaveText('滿 NT$1,000 可用');

    const pct = cards.filter({ hasText: '全站 85 折券' });
    await expect(pct.locator('.coupon-card-value')).toHaveText('15%');

    const freeship = cards.filter({ hasText: '免運券' });
    await expect(freeship.locator('.coupon-card-value')).toHaveText('免運');
    await expect(freeship.locator('.coupon-card-threshold')).toHaveText('無最低消費');

    // R-17.9: no apply control on this page
    await expect(page.getByRole('button', { name: '套用' })).toHaveCount(0);
    await expect(page.locator('input')).toHaveCount(0);

    // Empty used tab (R-17.8)
    await usedTab.click();
    await expect(page.getByText('這裡沒有優惠券')).toBeVisible();
    await expect(page.getByTestId('coupon-card')).toHaveCount(0);

    // Expired tab (A.2 EXPIRED50)
    await expiredTab.click();
    const expired = page.getByTestId('coupon-card');
    await expect(expired).toHaveCount(1);
    await expect(expired.locator('.coupon-card-name')).toHaveText('舊版折五十券');
    await expect(expired.locator('.coupon-card-code')).toHaveText('券碼 EXPIRED50');
    await expect(expired.locator('.coupon-card-status')).toHaveText('已過期');
    await expect(expired.locator('.coupon-card-threshold')).toHaveText('無最低消費');
  });

  test('used tab shows order id after checkout with coupon', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsDemo(page);
    await clearCartViaApi(page);
    await addFirstInStockViaApi(page);
    await goCheckoutFromCart(page);
    await fillCheckoutShipping(page);
    await page.getByRole('radio', { name: /新人小禮券/ }).check();
    await submitCheckout(page);

    const orderId = page.url().match(/MM-\d{8}-\d{4}/)?.[0];
    expect(orderId).toBeTruthy();

    await page.goto('/coupons');
    await page.locator('.coupons-tab', { hasText: '已使用' }).click();
    await expect(page.locator('.coupons-tab', { hasText: '已使用' })).toHaveText('已使用 (1)');

    const used = page.getByTestId('coupon-card').filter({ hasText: '新人小禮券' });
    await expect(used).toBeVisible();
    await expect(used.locator('.coupon-card-status')).toHaveText('已使用');
    await expect(used).toContainText('訂單編號');
    // Live UI currently omits "MM-" (see DEF-010); still assert serial is present
    await expect(used).toContainText(orderId!.replace(/^MM-/, ''));
  });

  test('DEF-010: used coupon order id should keep MM- prefix', async ({ page }) => {
    test.fail(true, 'DEF-010: 已使用券「訂單編號」省略 MM- 前綴（R-17.7 / R-6.9）');
    await loginAsDemo(page);
    await page.goto('/coupons');
    await page.locator('.coupons-tab', { hasText: '已使用' }).click();
    const used = page.getByTestId('coupon-card').filter({ hasText: '新人小禮券' });
    await expect(used).toContainText(/訂單編號 MM-\d{8}-\d{4}/);
  });
});

/**
 * Batch 8 — V-C01 redeem discount codes
 * R-17.1～R-17.4, R-18.8
 *
 * DEF-009: coupons page has no redeem input/「領取」; redeem API 404.
 */
test.describe('V-C01 redeem discount codes', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('WELCOME50 / SHIPFREE success, invalid, duplicate', async ({ page }) => {
    test.setTimeout(60_000);
    test.fail(
      true,
      'DEF-009: 我的優惠券無折扣碼輸入／領取；POST redeem API 不存在（R-17.1～R-17.3）',
    );

    await loginAsDemo(page);
    await page.goto('/coupons');

    const input = page.getByRole('textbox').or(page.locator('input')).first();
    const redeem = page.getByRole('button', { name: '領取' });
    await expect(input).toBeVisible();
    await expect(redeem).toBeVisible();

    await input.fill('WELCOME50');
    await redeem.click();
    await expect(page.getByRole('status')).toContainText('已領取〈歡迎折五十券〉');
    await expect(page.locator('.coupons-tab', { hasText: '可使用' })).toHaveText(/可使用 \(6\)/);

    await input.fill('SHIPFREE');
    await redeem.click();
    await expect(page.getByRole('status')).toContainText('已領取〈免運體驗券〉');

    await input.fill('NOPE999');
    await redeem.click();
    await expect(page.getByText('折扣碼不存在或已失效')).toBeVisible();

    await input.fill('WELCOME50');
    await redeem.click();
    await expect(page.getByText('此折扣碼已領取過')).toBeVisible();
  });
});
