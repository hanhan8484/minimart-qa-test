import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { DEMO_EMAIL, DEMO_PASSWORD } from './constants';

/** UI login via login form */
export async function loginAsDemo(page: Page, email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('form.login-card button[type="submit"]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.logout-btn')).toBeVisible();
}

/** API login; cookies stored on the request context */
export async function loginViaApi(
  request: APIRequestContext,
  email = DEMO_EMAIL,
  password = DEMO_PASSWORD,
) {
  const res = await request.post('/api/auth/login', {
    data: { email, password },
  });
  return res;
}

/** Clear cart using session cookies already on the page */
export async function clearCartViaApi(page: Page) {
  await page.evaluate(async () => {
    const cartRes = await fetch('/api/cart', { credentials: 'include' });
    const cart = await cartRes.json();
    const items = Array.isArray(cart?.items) ? cart.items : [];
    for (const item of items) {
      const res = await fetch(`/api/cart/items/${item.productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Failed to delete cart item ${item.productId}: ${res.status}`);
      }
    }
  });
}
