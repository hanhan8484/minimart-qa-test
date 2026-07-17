import { test, expect } from '@playwright/test';
import { DEMO_EMAIL, DEMO_PASSWORD, loginAsDemo, resetEnv } from '../helpers';

/**
 * Batch 1 — G UI login / guard
 * G-B01: R-18.8 login UI
 * G-B04: R-1.10 unauthenticated redirect
 */
test.describe('G-B01 / G-B04 login page & auth guard', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test('G-B01: login page, wrong password message, success goes to product list', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.locator('.login-brand')).toHaveText('MiniMart');
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();

    await page.locator('#login-email').fill(DEMO_EMAIL);
    await page.locator('#login-password').fill('not-the-password');
    await page.locator('form.login-card button[type="submit"]').click();
    await expect(page.locator('.login-error')).toHaveText('帳號或密碼錯誤');

    await page.locator('#login-password').fill(DEMO_PASSWORD);
    await page.locator('form.login-card button[type="submit"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.product-card').first()).toBeVisible();
    await expect(page.locator('.account')).toHaveText(DEMO_EMAIL);
  });

  test('G-B04: unauthenticated routes redirect to login', async ({ page }) => {
    const paths = ['/', '/cart', '/orders', '/coupons', '/notifications', '/checkout'];
    for (const path of paths) {
      await page.goto(path);
      await expect(page, `path ${path}`).toHaveURL(/\/login/);
    }
  });
});
