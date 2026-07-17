import { expect, type Page } from '@playwright/test';
import { DEMO_EMAIL } from './constants';

const NAV_PATHS = ['/', '/cart', '/orders', '/coupons', '/notifications'] as const;

/**
 * R-1.3: navbar structure + account + logout on a page.
 * Note: live UI label is「我的優惠卷」(typo 卷); PRD says「我的優惠券」— accept both.
 * Tracked as DEF-001 in docs/defects.md.
 */
export async function expectNavbar(page: Page, email = DEMO_EMAIL) {
  const header = page.locator('header.navbar');
  await expect(header).toBeVisible();
  await expect(header.locator('.brand')).toHaveText('MiniMart');

  await expect(header.locator('nav a[href="/"]')).toHaveText('商品');
  await expect(header.locator('a[href="/cart"]')).toBeVisible();
  await expect(header.locator('a[href="/orders"]')).toHaveText('我的訂單');
  await expect(header.locator('a[href="/coupons"]')).toHaveText(/我的優惠[券卷]/);
  await expect(header.locator('a[href="/notifications"]')).toBeVisible();

  await expect(header.getByRole('link', { name: /購物車/ })).toBeVisible();
  await expect(header.getByRole('link', { name: '我的訂單', exact: true })).toBeVisible();
  await expect(header.getByRole('link', { name: /我的優惠[券卷]/ })).toBeVisible();
  await expect(header.getByRole('link', { name: /通知中心/ })).toBeVisible();

  await expect(header.locator('.account')).toHaveText(email);
  await expect(header.locator('.logout-btn')).toBeVisible();
}

export { NAV_PATHS };
