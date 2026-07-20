import { test, expect } from '@playwright/test';
import {
  getDetailStatusText,
  loginAsDemo,
  openOrderDetail,
  resetEnv,
  seedCompletedId,
} from '../helpers';

const SHORT_REASON = '短'; // < 5 → 駁回
const REJECT_MSG = '退貨原因描述不足，請補充後重新申請';
const LONG_REASON = '第二次申請退貨原因足夠長';

/**
 * Batch 7 — O-C04 reject then re-apply
 * R-7.7, R-7.11, R-8.5, R-14.10, R-18.8
 */
test.describe.serial('O-C04 return reject and re-apply', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('short reason → 賣家審核 → 已駁回／已完成 + 可再申請', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsDemo(page);
    await openOrderDetail(page, seedCompletedId());
    await page.getByRole('button', { name: '申請退貨' }).click();

    await page.locator('textarea').fill(SHORT_REASON);
    await page.getByRole('button', { name: '送出申請' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${seedCompletedId()}$`));
    await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => getDetailStatusText(page), { timeout: 30_000 }).toBe('退貨中');

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          r.url().includes(`/api/orders/${seedCompletedId()}/returns/review`) &&
          r.ok(),
      ),
      page.getByRole('button', { name: '賣家審核（Demo）' }).click(),
    ]);

    await openOrderDetail(page, seedCompletedId());
    await expect.poll(async () => getDetailStatusText(page)).toBe('已完成');
    await expect(page.getByText(`駁回原因：${REJECT_MSG}`)).toBeVisible();
    await expect(page.getByRole('button', { name: '申請退貨' })).toBeVisible();

    const api = await page.evaluate(async (oid) => {
      const o = await fetch(`/api/orders/${oid}`, { credentials: 'include' }).then((r) => r.json());
      return {
        returnStatus: o.returnStatus,
        returnRejectReason: o.returnRejectReason,
        timeline: (o.returnTimeline || []).map((x: { status: string }) => x.status),
        canApplyReturn: o.canApplyReturn,
      };
    }, seedCompletedId());
    expect(api.returnStatus).toBe('已駁回');
    expect(api.returnRejectReason).toBe(REJECT_MSG);
    expect(api.timeline).toEqual(expect.arrayContaining(['待審核', '已駁回']));
    expect(api.canApplyReturn).toBe(true);

    // R-8.5 reject notification (API — UI 列表偶發長時間「載入中」)
    const titles = await page.evaluate(async () => {
      const list = await fetch('/api/notifications', { credentials: 'include' }).then((r) =>
        r.json(),
      );
      return list.map((n: { title: string }) => n.title);
    });
    expect(titles).toContain(`訂單 ${seedCompletedId()} 的退貨申請已駁回`);
  });

  test('re-apply after reject → 再次進入待審核', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsDemo(page);
    await openOrderDetail(page, seedCompletedId());
    await expect(page.getByText(`駁回原因：${REJECT_MSG}`)).toBeVisible();

    await page.getByRole('button', { name: '申請退貨' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${seedCompletedId()}/return`));
    await page.locator('textarea').fill(LONG_REASON);
    await page.getByRole('button', { name: '送出申請' }).click();

    await expect(page).toHaveURL(new RegExp(`/orders/${seedCompletedId()}$`));
    await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => getDetailStatusText(page), { timeout: 30_000 }).toBe('退貨中');
    await expect(page.getByRole('button', { name: '賣家審核（Demo）' })).toBeVisible();
    await expect(page.locator('.return-timeline-status', { hasText: '待審核' }).last()).toBeVisible();
  });
});

/**
 * Batch 7 — O-C05 revoke return application
 * R-7.12 — blocked by DEF-005 (no revoke button)
 */
test.describe('O-C05 revoke return application', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('revoke dialog → 無退貨／已完成', async ({ page }) => {
    test.setTimeout(90_000);
    test.fail(true, 'DEF-005: 待審核無「撤銷退貨申請」按鈕，O-C05 無法執行（R-7.12）');

    await loginAsDemo(page);
    await openOrderDetail(page, seedCompletedId());
    await page.getByRole('button', { name: '申請退貨' }).click();
    await page.locator('textarea').fill('準備撤銷的退貨申請');
    await page.getByRole('button', { name: '送出申請' }).click();
    await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => getDetailStatusText(page), { timeout: 30_000 }).toBe('退貨中');

    // Fail fast on missing control (DEF-005); full dialog path encoded below for when fixed
    await expect(page.getByRole('button', { name: '撤銷退貨申請' })).toBeVisible();
    await page.getByRole('button', { name: '撤銷退貨申請' }).click();
    await expect(page.getByText('確定要撤銷這次退貨申請嗎？')).toBeVisible();
    await page.getByRole('button', { name: '確定' }).click();

    await expect.poll(async () => getDetailStatusText(page), { timeout: 30_000 }).toBe('已完成');
    const api = await page.evaluate(async (oid) => {
      const o = await fetch(`/api/orders/${oid}`, { credentials: 'include' }).then((r) => r.json());
      return o.returnStatus;
    }, seedCompletedId());
    expect(api).toBe('無退貨');
  });
});
