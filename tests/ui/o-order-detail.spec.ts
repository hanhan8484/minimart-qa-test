import { test, expect } from '@playwright/test';
import {
  getDetailStatusText,
  getSummaryValueByLabel,
  loginAsDemo,
  openOrderDetail,
  resetEnv,
  applyPricingCaseCart,
  fillCheckoutShipping,
  goCheckoutFromCart,
  submitCheckout,
  clearCartViaApi,
} from '../helpers';
import { CASE_R56_2, CASE_R56_3 } from '../fixtures/pricing-cases';
import { seedCompletedId, seedPendingId, seedShippedId } from '../helpers/orders';

const completed = () => seedCompletedId();
const pending = () => seedPendingId();
const shipped = () => seedShippedId();

/**
 * Batch B-rest — O-B02 / O-B03 / O-B04 / O-B05 / O-B06
 * Shared remote SUT: keep order so O-B03’s return mutation runs last among seed-dependent cases.
 */
test.describe.serial('O-B02～O-B06 order UI', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('O-B02: detail five blocks; completed has 完成時間; summary order', async ({ page }) => {
    await loginAsDemo(page);
    await openOrderDetail(page, completed());

    const main = await page.locator('main').innerText();
    for (const block of ['訂單資訊', '商品明細', '金額摘要', '收件資訊', '狀態與操作']) {
      expect(main).toContain(block);
    }
    await expect(page.getByText('完成時間')).toBeVisible();
    await expect(page.getByText(completed())).toBeVisible();
    await expect(page.getByText('香氛蠟燭禮盒')).toBeVisible();
    await expect(page.getByText('測試收件人 2')).toBeVisible();

    const labels = await page.locator('[data-testid="summary-row-label"]').allTextContents();
    expect(labels.map((s) => s.trim())).toEqual([
      '商品小計',
      '滿額折扣',
      '優惠券折抵',
      '運費',
      '應付金額',
    ]);
  });

  test('O-B04: cancel does not create return; illegal entry redirects', async ({ page }) => {
    await loginAsDemo(page);
    await openOrderDetail(page, completed());
    await page.getByRole('button', { name: '申請退貨' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${completed()}/return`));
    await page.getByRole('link', { name: '取消' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${completed()}$`));

    const order = await page.evaluate(async (oid) => {
      return fetch(`/api/orders/${oid}`, { credentials: 'include' }).then((r) => r.json());
    }, completed());
    expect(order.status).toBe('已完成');
    expect(order.returnStatus === '無退貨' || order.returnStatus == null).toBeTruthy();

    await page.goto(`/orders/${pending()}/return`);
    await expect(page).toHaveURL(new RegExp(`/orders/${pending()}$`));
    await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible();
  });

  test('O-B04: empty / over-200 reason disables submit; counter', async ({ page }) => {
    await loginAsDemo(page);
    await page.goto(`/orders/${completed()}/return`);
    const ta = page.locator('textarea');
    const submit = page.getByRole('button', { name: '送出申請' });

    await expect(ta).toBeVisible();
    await expect(submit).toBeDisabled();
    await expect(page.getByText('0/200')).toBeVisible();

    await ta.fill('x'.repeat(201));
    expect(await ta.inputValue()).toHaveLength(201);
    await expect(submit).toBeDisabled();
    await expect(page.getByText('201/200')).toBeVisible();
  });

  test('O-B04 DEF: reason error copy for empty / over 200', async ({ page }) => {
    test.fail(
      true,
      'DEF-017: 退貨原因空／超過 200 字時未顯示 PRD 紅字「請填寫退貨原因」「退貨原因不可超過 200 個字」',
    );
    await loginAsDemo(page);
    await page.goto(`/orders/${completed()}/return`);
    const ta = page.locator('textarea');
    await ta.fill('');
    await ta.blur();
    await expect(page.getByText('請填寫退貨原因')).toBeVisible();
    await ta.fill('x'.repeat(201));
    await ta.blur();
    await expect(page.getByText('退貨原因不可超過 200 個字')).toBeVisible();
  });

  test('O-B06: return apply page refund strings match seed completed order', async ({ page }) => {
    await loginAsDemo(page);
    await openOrderDetail(page, completed());
    // Seed 已完成：應付 1290、運費 30 → 預計退款 1260
    await page.getByRole('button', { name: '申請退貨' }).click();
    await expect(page.locator('.return-refund-amount')).toHaveText('NT$1,260');
    await expect(page.locator('.return-refund-note')).toHaveText('（不含運費 NT$30）');
  });

  test('O-B05: order detail summary matches CASE_R56_2 fixture', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsDemo(page);
    await clearCartViaApi(page);
    await applyPricingCaseCart(page, CASE_R56_2);
    await goCheckoutFromCart(page);
    await fillCheckoutShipping(page);
    await submitCheckout(page);
    await page.getByRole('button', { name: '查看訂單' }).click();
    await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible();

    const d = CASE_R56_2.display;
    expect(await getSummaryValueByLabel(page, '商品小計')).toBe(d.subtotal);
    expect(await getSummaryValueByLabel(page, '滿額折扣')).toBe(d.bulkDiscount);
    expect(await getSummaryValueByLabel(page, '優惠券折抵')).toBe(d.couponDiscount);
    expect(await getSummaryValueByLabel(page, '運費')).toBe(d.shipping);
    expect(await getSummaryValueByLabel(page, '應付金額')).toBe(d.payable);
  });

  test('O-B05 + coupon: CASE_R56_3 detail rows vs fixture (DEF-004 family)', async ({ page }) => {
    test.setTimeout(90_000);
    const swapWouldBreak =
      CASE_R56_3.expect.bulkDiscount !== CASE_R56_3.expect.couponDiscount;
    test.fail(
      swapWouldBreak,
      'DEF-004: 訂單詳情金額摘要亦可能滿額／券折抵對調；以 PRD 標籤對齊 fixture',
    );

    await loginAsDemo(page);
    await clearCartViaApi(page);
    await applyPricingCaseCart(page, CASE_R56_3);
    await goCheckoutFromCart(page);
    await page.getByRole('radio', { name: /滿三千折三百券/ }).check();
    await expect
      .poll(async () => getSummaryValueByLabel(page, '應付金額'))
      .toBe(CASE_R56_3.display.payable);
    await fillCheckoutShipping(page);
    await submitCheckout(page);
    await page.getByRole('button', { name: '查看訂單' }).click();
    await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible();

    const d = CASE_R56_3.display;
    expect(await getSummaryValueByLabel(page, '商品小計')).toBe(d.subtotal);
    expect(await getSummaryValueByLabel(page, '滿額折扣')).toBe(d.bulkDiscount);
    expect(await getSummaryValueByLabel(page, '優惠券折抵')).toBe(d.couponDiscount);
    expect(await getSummaryValueByLabel(page, '運費')).toBe(d.shipping);
    expect(await getSummaryValueByLabel(page, '應付金額')).toBe(d.payable);
  });

  test('O-B03: action buttons by status', async ({ page }) => {
    test.setTimeout(90_000);
    // Re-seed so completed seed is again 已完成 after prior cases
    await resetEnv(page.request);
    await loginAsDemo(page);

    await openOrderDetail(page, pending());
    await expect(page.getByRole('button', { name: '模擬出貨（Demo）' })).toBeVisible();
    await expect(page.getByRole('button', { name: '取消訂單' })).toHaveCount(0);

    await openOrderDetail(page, shipped());
    await expect(page.getByRole('button', { name: '確認收貨' })).toBeVisible();
    await expect(page.getByRole('button', { name: '模擬出貨（Demo）' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '取消訂單' })).toHaveCount(0);

    await openOrderDetail(page, completed());
    await expect(page.getByRole('button', { name: '申請退貨' })).toBeVisible();

    await page.getByRole('button', { name: '申請退貨' }).click();
    await page.locator('textarea').fill('商品有瑕疵需要退貨');
    await page.getByRole('button', { name: '送出申請' }).click();
    await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => getDetailStatusText(page), { timeout: 30_000 }).toBe('退貨中');
    await expect(page.getByRole('button', { name: '確認收貨' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '取消訂單' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '賣家審核（Demo）' })).toBeVisible();
  });
});
