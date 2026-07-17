import { test, expect } from '@playwright/test';
import { loginAsDemo, placeOrderAndOpenDetail, resetEnv } from '../helpers';

/**
 * Batch 3 — O-C02 R-6.5 cancel within 10 minutes
 *
 * DEF-003: new 待出貨 order detail has no「取消訂單」button;
 * order JSON has no canCancel; POST …/cancel → 404.
 */
test.describe('O-C02 cancel order within 10 minutes', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('new order shows cancel dialog → 已取消', async ({ page }) => {
    test.setTimeout(90_000);
    test.fail(
      true,
      'DEF-003: 待出貨且未滿 10 分鐘仍無「取消訂單」按鈕／無 cancel API（R-6.5）',
    );

    await loginAsDemo(page);
    const orderId = await placeOrderAndOpenDetail(page, {
      name: '取消流程測試',
      phone: '0912345678',
      address: '台北市信義區測試路 1 號',
    });

    await expect(page.getByText('待出貨').first()).toBeVisible();
    const cancelBtn = page.getByRole('button', { name: '取消訂單' });
    await expect(cancelBtn).toBeVisible();

    await cancelBtn.click();
    await expect(page.getByText('確定要取消這筆訂單嗎？')).toBeVisible();
    await page.getByRole('button', { name: '確定' }).click();

    await expect
      .poll(async () => {
        const main = await page.locator('main').innerText();
        const m = main.match(/訂單狀態\s*\n?\s*(待出貨|已出貨|已完成|已取消|退貨中|已退款)/);
        return m?.[1] ?? '';
      })
      .toBe('已取消');

    await expect(page.getByRole('button', { name: '取消訂單' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '模擬出貨（Demo）' })).toHaveCount(0);
    await expect(page.getByText(orderId)).toBeVisible();
  });
});
