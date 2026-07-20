import { test, expect } from '@playwright/test';
import {
  getDetailStatusText,
  loginAsDemo,
  openOrderDetail,
  resetEnv,
  seedCompletedId,
} from '../helpers';

/** Day-0 A.4 第二筆：已完成、7 天內可退；應付 1290、運費 30 → 應退 1260 */
const EXPECT_REFUND = 'NT$1,260';
const EXPECT_SHIPPING_NOTE = '（不含運費 NT$30）';
const RETURN_REASON = '商品有瑕疵需要退貨'; // >= 5 字 → 審核通過

/**
 * Batch 6 — O-C03 return approved through refund
 * R-6.6, R-7.1～R-7.6, R-7.8, R-7.9, R-8.4, R-8.6, R-16.1～R-16.5, R-16.7
 *
 * Known live defects (asserted in dedicated test.fail cases):
 * DEF-005 待審核無「撤銷退貨申請」
 * DEF-006 refundAmount／畫面／通知退款金額不正確（應為 payable−shipping）
 * DEF-007 時間軸未寫入「退款處理中」「已退款」
 * v2.1 changelog 宣稱 DEF-008 已修；2026-07-20 複驗 refundedAt 仍為 null
 */
test.describe.serial('O-C03 return to refund', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('apply page + submit → 退貨中／待審核 + 受理通知', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsDemo(page);
    await openOrderDetail(page, seedCompletedId());
    await expect(page.getByText('已完成').first()).toBeVisible();
    await page.getByRole('button', { name: '申請退貨' }).click();

    await expect(page).toHaveURL(new RegExp(`/orders/${seedCompletedId()}/return`));
    await expect(page.getByRole('heading', { name: '申請退貨' })).toBeVisible();
    await expect(page.getByText(seedCompletedId())).toBeVisible();
    await expect(page.getByText('香氛蠟燭禮盒')).toBeVisible();
    await expect(page.getByText('純棉素色 T 恤')).toBeVisible();
    await expect(page.locator('.return-refund-amount')).toHaveText(EXPECT_REFUND);
    await expect(page.locator('.return-refund-note')).toHaveText(EXPECT_SHIPPING_NOTE);
    await expect(page.getByRole('link', { name: '取消' })).toBeVisible();

    const reason = page.locator('textarea');
    const submit = page.getByRole('button', { name: '送出申請' });
    await expect(page.getByText('0/200')).toBeVisible();
    await expect(submit).toBeDisabled();

    await reason.fill(RETURN_REASON);
    await expect(page.getByText(`${RETURN_REASON.length}/200`)).toBeVisible();
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page).toHaveURL(new RegExp(`/orders/${seedCompletedId()}$`));
    await expect.poll(async () => getDetailStatusText(page)).toBe('退貨中');
    await expect(page.getByText('待審核')).toBeVisible();
    await expect(page.getByRole('button', { name: '賣家審核（Demo）' })).toBeVisible();

    await page.goto('/notifications');
    await expect(
      page.getByText(`訂單 ${seedCompletedId()} 的退貨申請已送出`).first(),
    ).toBeVisible();
  });

  test('DEF-005: 待審核應有撤銷退貨申請', async ({ page }) => {
    test.fail(true, 'DEF-005: 待審核狀態缺少「撤銷退貨申請」按鈕（R-7.12）');
    await loginAsDemo(page);
    await openOrderDetail(page, seedCompletedId());
    await expect(page.getByRole('button', { name: '撤銷退貨申請' })).toBeVisible();
  });

  test('seller review → 已退款 + 通過／退款通知', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsDemo(page);
    await openOrderDetail(page, seedCompletedId());
    await expect(page.getByRole('button', { name: '賣家審核（Demo）' })).toBeVisible();

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
    await expect.poll(async () => getDetailStatusText(page)).toBe('已退款');
    await expect(page.getByText('退款金額')).toBeVisible();

    await page.goto('/notifications');
    await expect(
      page.getByText(`訂單 ${seedCompletedId()} 的退貨申請已通過`).first(),
    ).toBeVisible();
    await expect(page.getByText(`訂單 ${seedCompletedId()} 已退款`).first()).toBeVisible();
  });

  test('DEF-006: 退款金額應為 payable − shipping', async ({ page }) => {
    test.fail(
      true,
      'DEF-006: refundAmount/畫面為 NT$1,230（應 NT$1,260）；通知曾顯示應付全額（R-7.10）',
    );
    await loginAsDemo(page);
    await openOrderDetail(page, seedCompletedId());

    const refundFromApi = await page.evaluate(async (oid) => {
      const o = await fetch(`/api/orders/${oid}`, { credentials: 'include' }).then((r) =>
        r.json(),
      );
      return o.refundAmount;
    }, seedCompletedId());
    expect(refundFromApi).toBe(1260);

    // UI row near 退款金額
    const main = await page.locator('main').innerText();
    expect(main).toMatch(/退款金額\s*\n?\s*NT\$1,260/);

    await page.goto('/notifications');
    await expect(page.getByText('退款金額 NT$1,260').first()).toBeVisible();
  });

  test('DEF-007: 時間軸應含退款處理中與已退款', async ({ page }) => {
    test.fail(true, 'DEF-007: returnTimeline 審核通過後仍只有「待審核」（R-7.8 / R-16.7）');
    await loginAsDemo(page);
    await openOrderDetail(page, seedCompletedId());

    const timeline = await page.evaluate(async (oid) => {
      const o = await fetch(`/api/orders/${oid}`, { credentials: 'include' }).then((r) =>
        r.json(),
      );
      return (o.returnTimeline || []).map((x: { status: string }) => x.status);
    }, seedCompletedId());

    expect(timeline).toEqual(expect.arrayContaining(['待審核', '退款處理中', '已退款']));
    await expect(page.getByText('退款處理中')).toBeVisible();
    await expect(page.getByText('已退款', { exact: true }).first()).toBeVisible();
  });

  test('DEF-008: 應記錄並顯示退款時間', async ({ page }) => {
    test.fail(
      true,
      'DEF-008: v2.1 宣稱已修，但退款後 refundedAt 仍為 null、詳情退款時間空白（R-7.9）',
    );
    await loginAsDemo(page);
    await openOrderDetail(page, seedCompletedId());

    const refundedAt = await page.evaluate(async (oid) => {
      const o = await fetch(`/api/orders/${oid}`, { credentials: 'include' }).then((r) =>
        r.json(),
      );
      return o.refundedAt;
    }, seedCompletedId());
    expect(refundedAt).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);

    const main = await page.locator('main').innerText();
    expect(main).toMatch(/退款時間\s*\n?\s*\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });
});
