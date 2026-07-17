import { test, expect, type Page } from '@playwright/test';
import { loginAsDemo, resetEnv } from '../helpers';
import { SEED_ORDER_IDS } from '../helpers/orders';

/** Build unread notification payloads for badge mock (R-1.5 99+) */
function mockUnreadNotifications(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    type: 'ORDER_CONFIRMED',
    orderId: `MM-20990101-${String(i + 1).padStart(4, '0')}`,
    title: `訂單 MM-20990101-${String(i + 1).padStart(4, '0')} 已成立`,
    body: `下單時間 2099-01-01 00:00\n商品 × 1\n應付金額 NT$1\n收件人 mock`,
    createdAt: '2099-01-01 00:00',
    read: false,
  }));
}

/** Only mock GET list `/api/notifications` (not read endpoints). */
async function mockNotificationsList(page: Page, body: unknown) {
  await page.route('**/api/notifications**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const path = new URL(route.request().url()).pathname;
    if (!/\/api\/notifications\/?$/.test(path)) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/**
 * Batch 5 — N-B01 / N-B02 notifications
 * R-15.1～R-15.6, R-8.7～R-8.9, R-1.5, A.5
 */
test.describe('N-B01 / N-B02 notifications', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('N-B02 + N-B01 real: A.5 seed, read one, mark all, no delete', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsDemo(page);

    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: '通知中心' })).toBeVisible();
    await expect(page.locator('.notifications-unread-count')).toHaveText('未讀 3 則');
    await expect(page.getByTestId('notif-badge')).toHaveText('3');

    const rows = page.getByTestId('notification-row');
    await expect(rows).toHaveCount(3);

    // Newest → oldest (R-8.7) matching A.4 / A.5
    await expect(rows.nth(0).locator('.notification-title')).toHaveText(
      `訂單 ${SEED_ORDER_IDS[0]} 已成立`,
    );
    await expect(rows.nth(1).locator('.notification-title')).toHaveText(
      `訂單 ${SEED_ORDER_IDS[1]} 已成立`,
    );
    await expect(rows.nth(2).locator('.notification-title')).toHaveText(
      `訂單 ${SEED_ORDER_IDS[2]} 已成立`,
    );

    // A.5 bodies (R-8.2 four parts; order 2 has 2 line items)
    const body0 = rows.nth(0).locator('.notification-body');
    await expect(body0).toContainText('下單時間 2026-07-12 20:05');
    await expect(body0).toContainText('不鏽鋼保溫瓶 × 1');
    await expect(body0).toContainText('應付金額 NT$750');
    await expect(body0).toContainText('收件人 測試收件人 3');

    const body1 = rows.nth(1).locator('.notification-body');
    await expect(body1).toContainText('香氛蠟燭禮盒 × 1');
    await expect(body1).toContainText('純棉素色 T 恤 × 1');
    await expect(body1).toContainText('應付金額 NT$1,290');

    const body2 = rows.nth(2).locator('.notification-body');
    await expect(body2).toContainText('手沖咖啡濾杯 × 2');
    await expect(body2).toContainText('應付金額 NT$1,020');

    // Unread dots on all
    await expect(rows.nth(0).getByTestId('unread-dot')).toBeVisible();
    await expect(rows.nth(1).getByTestId('unread-dot')).toBeVisible();
    await expect(rows.nth(2).getByTestId('unread-dot')).toBeVisible();

    // Click first → read, badge −1 (R-8.8)
    await rows.nth(0).click();
    await expect(rows.nth(0).getByTestId('unread-dot')).toHaveCount(0);
    await expect(page.locator('.notifications-unread-count')).toHaveText('未讀 2 則');
    await expect(page.getByTestId('notif-badge')).toHaveText('2');
    // Still on list (R-15.3)
    await expect(rows).toHaveCount(3);

    // Mark all read (R-15.5)
    await page.locator('.notifications-mark-all-btn').click();
    await expect(page.locator('.notifications-unread-count')).toHaveText('未讀 0 則');
    await expect(page.getByTestId('unread-dot')).toHaveCount(0);
    await expect(page.getByTestId('notif-badge')).toHaveCount(0);
    await expect(rows).toHaveCount(3);

    // No delete (R-8.9)
    await expect(page.getByRole('button', { name: /刪除/ })).toHaveCount(0);
  });

  test('N-B01 @mock: empty list shows 目前沒有通知', async ({ page }) => {
    await loginAsDemo(page);
    await mockNotificationsList(page, []);

    await page.goto('/notifications');
    await expect(page.getByText('目前沒有通知')).toBeVisible();
    await expect(page.getByTestId('notification-row')).toHaveCount(0);

    await page.goto('/');
    await expect(page.getByTestId('notif-badge')).toHaveCount(0);
  });

  test('N-B01 @mock: unread ≥100 shows badge 99+', async ({ page }) => {
    await loginAsDemo(page);
    await mockNotificationsList(page, mockUnreadNotifications(100));

    await page.goto('/');
    await expect(page.getByTestId('notif-badge')).toHaveText('99+');

    await page.goto('/notifications');
    await expect(page.locator('.notifications-unread-count')).toHaveText('未讀 100 則');
    await expect(page.getByTestId('notif-badge')).toHaveText('99+');
  });
});
