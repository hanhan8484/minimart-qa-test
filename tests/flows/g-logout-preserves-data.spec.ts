import { test, expect } from '@playwright/test';
import { loginAsDemo, resetEnv } from '../helpers';

type Snapshot = {
  orderIds: string[];
  couponCodes: string[];
  couponStatuses: string[];
  notificationIds: number[];
  notificationTitles: string[];
  unreadCount: number;
};

async function snapshotAccount(page: import('@playwright/test').Page): Promise<Snapshot> {
  return page.evaluate(async () => {
    const [orders, coupons, notifications] = await Promise.all([
      fetch('/api/orders', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/coupons', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/notifications', { credentials: 'include' }).then((r) => r.json()),
    ]);
    return {
      orderIds: (orders as { id: string }[]).map((o) => o.id),
      couponCodes: (coupons as { code: string }[]).map((c) => c.code),
      couponStatuses: (coupons as { status: string }[]).map((c) => c.status),
      notificationIds: (notifications as { id: number }[]).map((n) => n.id),
      notificationTitles: (notifications as { title: string }[]).map((n) => n.title),
      unreadCount: (notifications as { read: boolean }[]).filter((n) => !n.read).length,
    };
  });
}

/**
 * Batch 9 — G-C02 R-1.8 logout keeps orders / coupons / notifications
 */
test.describe('G-C02 logout preserves account data', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('after logout and re-login, orders coupons notifications unchanged', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsDemo(page);

    // Touch UI pages so we also assert visible continuity
    await page.goto('/orders');
    await expect(page.locator('.order-row').first()).toBeVisible();
    await page.goto('/coupons');
    await expect(page.getByTestId('coupon-card').first()).toBeVisible();
    await page.goto('/notifications');
    await expect(page.getByTestId('notification-row').first()).toBeVisible();

    const before = await snapshotAccount(page);
    expect(before.orderIds.length).toBeGreaterThanOrEqual(3);
    expect(before.couponCodes.length).toBeGreaterThanOrEqual(6);
    expect(before.notificationIds.length).toBeGreaterThanOrEqual(3);
    expect(before.unreadCount).toBeGreaterThan(0);

    await page.locator('.logout-btn').click();
    await expect(page).toHaveURL(/\/login/);

    await loginAsDemo(page);
    const after = await snapshotAccount(page);

    expect(after.orderIds).toEqual(before.orderIds);
    expect(after.couponCodes).toEqual(before.couponCodes);
    expect(after.couponStatuses).toEqual(before.couponStatuses);
    expect(after.notificationIds).toEqual(before.notificationIds);
    expect(after.notificationTitles).toEqual(before.notificationTitles);
    expect(after.unreadCount).toBe(before.unreadCount);

    // UI still shows seed data
    await page.goto('/orders');
    await expect(page.locator('.order-row')).toHaveCount(before.orderIds.length);
    await page.goto('/coupons');
    await expect(page.locator('.coupons-tab', { hasText: '可使用' })).toContainText('可使用');
    await page.goto('/notifications');
    await expect(page.getByTestId('notification-row')).toHaveCount(before.notificationIds.length);
  });
});
