import { test, expect } from '@playwright/test';
import {
  applyPricingCaseCart,
  loginAsDemo,
  resetEnv,
} from '../helpers';
import { CASE_SHIP_LT500 } from '../fixtures/pricing-cases';

/**
 * Batch 10 — C-B07 checkout shipping field validation
 * R-12.2, R-12.6, R-18.1～R-18.5, R-18.7～R-18.9
 */
test.describe('C-B07 checkout shipping validation', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await applyPricingCaseCart(page, CASE_SHIP_LT500);
    await page.goto('/checkout');
    await expect(page.locator('.checkout-page')).toBeVisible();
  });

  test('empty / bad fields disable submit; name & phone show exact errors', async ({ page }) => {
    const submit = page.locator('.checkout-submit-btn');
    await expect(submit).toBeDisabled();

    await page.locator('#checkout-name').fill('');
    await page.locator('#checkout-phone').fill('123');
    await page.locator('#checkout-address').fill('短');
    await page.locator('#checkout-name').blur();
    await page.locator('#checkout-phone').blur();
    await page.locator('#checkout-address').blur();

    await expect(submit).toBeDisabled();
    await expect(page.getByText('請輸入收件人姓名')).toBeVisible();
    await expect(
      page.getByText('請輸入正確的手機號碼（09 開頭，共 10 位數字）'),
    ).toBeVisible();
  });

  test('name over 20 chars not truncated; shows exact error', async ({ page }) => {
    const longName = '甲'.repeat(25);
    await page.locator('#checkout-name').fill(longName);
    expect(await page.locator('#checkout-name').inputValue()).toHaveLength(25);
    await page.locator('#checkout-name').blur();
    await expect(page.getByText('收件人姓名不可超過 20 個字')).toBeVisible();
    await expect(page.locator('.checkout-submit-btn')).toBeDisabled();
  });

  test('trim allows submit when padded name is otherwise valid', async ({ page }) => {
    await page.locator('#checkout-name').fill('  測試收件  ');
    await page.locator('#checkout-phone').fill('0912345678');
    await page.locator('#checkout-address').fill('台北市信義區測試路一段100號');
    await expect(page.locator('.checkout-submit-btn')).toBeEnabled();
  });

  test('address over 100 chars not truncated', async ({ page }) => {
    const longAddr = '北'.repeat(101);
    await page.locator('#checkout-address').fill(longAddr);
    expect(await page.locator('#checkout-address').inputValue()).toHaveLength(101);
  });

  test('DEF-011: address validation should show red error texts', async ({ page }) => {
    test.fail(
      true,
      'DEF-011: 收件地址空／過短／過長時不顯示 R-18.8 紅字（僅停用送出）（R-18.7）',
    );

    await page.locator('#checkout-name').fill('測試');
    await page.locator('#checkout-phone').fill('0912345678');

    await page.locator('#checkout-address').fill('');
    await page.locator('#checkout-address').blur();
    await expect(page.getByText('請輸入收件地址')).toBeVisible();

    await page.locator('#checkout-address').fill('短址');
    await page.locator('#checkout-address').blur();
    await expect(page.getByText('收件地址須為 5 至 100 個字')).toBeVisible();

    await page.locator('#checkout-address').fill('北'.repeat(101));
    await page.locator('#checkout-address').blur();
    await expect(page.getByText('收件地址須為 5 至 100 個字')).toBeVisible();
  });
});
