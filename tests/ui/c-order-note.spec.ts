import { test, expect } from '@playwright/test';
import {
  addFirstInStockViaApi,
  checkoutNoteField,
  clearCartViaApi,
  fillCheckoutShipping,
  goCheckoutFromCart,
  loginAsDemo,
  openOrderDetail,
  resetEnv,
  seedCompletedId,
  submitCheckout,
} from '../helpers';

/**
 * v2.1 — Order note (R-12.12 / R-14.11 / R-18.10)
 * Spec: docs/PRD-v2.1-supplement.md
 */
test.describe('C-B11 / O-B07 order note (v2.1)', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await clearCartViaApi(page);
    await addFirstInStockViaApi(page);
    await goCheckoutFromCart(page);
    await expect(page.locator('#checkout-name')).toBeVisible({ timeout: 20_000 });
    await fillCheckoutShipping(page);
    await expect(checkoutNoteField(page)).toBeVisible({ timeout: 10_000 });
  });

  test('R-12.12: note field between shipping and coupons; counter 0/100', async ({ page }) => {
    await expect(page.getByText('訂單備註（選填）')).toBeVisible();
    const note = checkoutNoteField(page);
    await expect(note).toBeVisible();

    const pageText = await page.locator('.checkout-page, main').first().innerText();
    const iShip = pageText.indexOf('收件資訊');
    const iNote = pageText.indexOf('訂單備註');
    const iCoupon = pageText.indexOf('優惠券');
    expect(iShip).toBeGreaterThanOrEqual(0);
    expect(iNote).toBeGreaterThan(iShip);
    expect(iCoupon).toBeGreaterThan(iNote);

    await expect(page.getByText('0/100')).toBeVisible();
    await expect(page.locator('.checkout-submit-btn')).toBeEnabled();
  });

  test('R-18.10: over 100 chars shows red error and disables submit', async ({ page }) => {
    const note = checkoutNoteField(page);
    const over = '測'.repeat(101);
    await note.fill(over);
    await expect(page.getByText('101/100')).toBeVisible();
    await expect(page.getByText('訂單備註不可超過 100 個字')).toBeVisible();
    await expect(page.locator('.checkout-submit-btn')).toBeDisabled();
  });

  test('R-12.12 / R-14.11: blank note allowed; detail shows （無備註）', async ({ page }) => {
    const note = checkoutNoteField(page);
    await note.fill('   ');
    await expect(page.getByText(/\d+\/100/)).toBeVisible();
    await submitCheckout(page);
    await page.getByRole('button', { name: '查看訂單' }).click();
    await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible();
    await expect(page.getByText('（無備註）')).toBeVisible();
  });

  test('R-14.11: filled note trimmed and shown on detail; not on list/complete', async ({
    page,
  }) => {
    const trimmed = '請放管理室門口';
    await checkoutNoteField(page).fill(`  ${trimmed}  `);
    // Counter may count raw or trimmed; just require it updates away from 0/100
    await expect(page.locator('.checkout-note-counter, .checkout-page')).toContainText(/[1-9]\d*\/100/);

    await submitCheckout(page);
    await expect(page.getByRole('heading', { name: '訂單已成立' })).toBeVisible();
    await expect(page.getByText(trimmed)).toHaveCount(0);

    const orderId = page.url().match(/MM-\d{8}-\d{4}/)![0];
    await page.getByRole('button', { name: '查看訂單' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
    await expect(page.getByText(trimmed)).toBeVisible();
    await expect(page.getByText('（無備註）')).toHaveCount(0);

    await page.goto('/orders');
    const row = page.locator('.order-row').filter({ hasText: orderId });
    await expect(row).toBeVisible();
    await expect(row.getByText(trimmed)).toHaveCount(0);
  });

  test('R-14.11: seed / pre-v2.1 orders show （無備註）', async ({ page }) => {
    await openOrderDetail(page, seedCompletedId());
    await expect(page.getByText('（無備註）')).toBeVisible();
  });
});
