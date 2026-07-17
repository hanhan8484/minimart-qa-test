import { test, expect } from '@playwright/test';
import { loginAsDemo, resetEnv } from '../helpers';
import { getDetailStatusText, openOrderDetail, SEED_ORDER_IDS } from '../helpers/orders';

/**
 * Batch 3 — O-C01 R-6.3 / R-6.4 / R-8.3
 * 模擬出貨 → 已出貨 + 出貨通知 → 確認收貨 → 已完成 + 完成時間
 *
 * Note: after 模擬出貨 the detail view often stays on 待出貨 until reload
 * (API + notification succeed). Test reloads to assert persisted status.
 */
test.describe('O-C01 ship then confirm receipt', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('Demo ship → notification → confirm → completed', async ({ page }) => {
    test.setTimeout(90_000);

    const orderId = SEED_ORDER_IDS[0]; // Day-0 待出貨
    await loginAsDemo(page);
    await openOrderDetail(page, orderId);
    await expect(page.getByText('待出貨').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '模擬出貨（Demo）' })).toBeVisible();
    await expect(page.getByRole('button', { name: '取消訂單' })).toHaveCount(0);

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          r.url().includes(`/api/orders/${orderId}/ship`) &&
          r.ok(),
      ),
      page.getByRole('button', { name: '模擬出貨（Demo）' }).click(),
    ]);

    // R-8.3 ship notification
    await page.goto('/notifications');
    await expect(page.getByText(`訂單 ${orderId} 已出貨`).first()).toBeVisible();

    // Persisted status on detail (reload — live UI may not auto-refresh after ship)
    await openOrderDetail(page, orderId);
    await expect.poll(async () => getDetailStatusText(page)).toBe('已出貨');
    await expect(page.getByRole('button', { name: '確認收貨' })).toBeVisible();
    await expect(page.getByRole('button', { name: '模擬出貨（Demo）' })).toHaveCount(0);

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          r.url().includes(`/api/orders/${orderId}/confirm-receipt`) &&
          r.ok(),
      ),
      page.getByRole('button', { name: '確認收貨' }).click(),
    ]);

    // Persist check（與出貨相同：部分環境詳情不即時重繪）
    await openOrderDetail(page, orderId);
    await expect.poll(async () => getDetailStatusText(page)).toBe('已完成');
    await expect(page.getByText('完成時間')).toBeVisible();
    await expect(page.getByRole('button', { name: '申請退貨' })).toBeVisible();
  });
});
