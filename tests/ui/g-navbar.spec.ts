import { test, expect } from '@playwright/test';
import { expectNavbar, loginAsDemo, NAV_PATHS, resetEnv } from '../helpers';

/**
 * Batch 1 — G-B02 R-1.3 navbar on every main page
 */
test.describe('G-B02 navbar always shows account & logout', () => {
  test.beforeAll(async ({ request }) => {
    test.setTimeout(60_000);
    await resetEnv(request);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test('navbar structure on all main pages; brand returns to products', async ({ page }) => {
    for (const path of NAV_PATHS) {
      await page.goto(path);
      await expectNavbar(page);
    }

    await page.goto('/cart');
    await page.locator('header.navbar .brand').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.product-list-page, .product-card').first()).toBeVisible();
  });
});
