import { test, expect } from '@playwright/test';
import { loginAsDemo, openOrderDetail, resetEnv } from '../helpers';
import { SEED_ORDER_IDS } from '../helpers/orders';

/**
 * Batch B-rest — G-B03 / G-B05
 */
test.describe('G-B03 / G-B05 global UI', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('G-B03: content area shows loading copy while APIs slow', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsDemo(page);

    // Hold the notifications API until we assert loading (avoids race with fast responses / cache).
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/notifications**', async (route) => {
      await held;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/載入中/)).toBeVisible({ timeout: 10_000 });
    release();
    await expect(page.getByText('目前沒有通知')).toBeVisible({ timeout: 10_000 });
  });

  test('G-B03 DEF-016: products/orders should use 載入中…', async ({ page }) => {
    test.setTimeout(60_000);
    test.fail(
      true,
      'DEF-016: 商品／訂單載入文案為「載入商品中...」「載入訂單中...」而非「載入中…」（R-1.9）',
    );

    await loginAsDemo(page);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/products**', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('載入中…')).toBeVisible({ timeout: 10_000 });
    release();
  });

  test('G-B05: datetimes use YYYY-MM-DD HH:mm; date-only YYYY-MM-DD', async ({ page }) => {
    await loginAsDemo(page);

    await page.goto('/orders');
    await expect(page.locator('.order-row').first()).toBeVisible();
    const orderTimes = await page.locator('.order-row-createdAt').allTextContents();
    expect(orderTimes.length).toBeGreaterThan(0);
    for (const t of orderTimes) {
      expect(t.trim()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    }

    await openOrderDetail(page, SEED_ORDER_IDS[0]);
    const detail = await page.locator('main').innerText();
    const dtMatches = detail.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g) ?? [];
    expect(dtMatches.length).toBeGreaterThan(0);

    await page.goto('/notifications');
    await expect(page.getByTestId('notification-row').first()).toBeVisible();
    const notifTimes = await page.locator('.notification-created-at').allTextContents();
    for (const t of notifTimes) {
      expect(t.trim()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    }

    await page.goto('/coupons');
    await expect(page.getByTestId('coupon-card').first()).toBeVisible();
    const exp = (await page.locator('.coupon-card-expires').first().innerText()).trim();
    expect(exp).toMatch(/到期日 \d{4}-\d{2}-\d{2}$/);
  });
});
