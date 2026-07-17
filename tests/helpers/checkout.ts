import { expect, type Page } from '@playwright/test';

export type ShippingInfo = {
  name: string;
  phone: string;
  address: string;
};

export const DEFAULT_SHIPPING: ShippingInfo = {
  name: '測試收件人',
  phone: '0912345678',
  address: '台北市測試路一段100號',
};

export async function fillCheckoutShipping(page: Page, info: ShippingInfo = DEFAULT_SHIPPING) {
  await page.locator('#checkout-name').fill(info.name);
  await page.locator('#checkout-phone').fill(info.phone);
  await page.locator('#checkout-address').fill(info.address);
}

export async function goCheckoutFromCart(page: Page) {
  await page.goto('/cart');
  await expect(page.locator('.cart-row').first()).toBeVisible();
  await page.locator('.checkout-btn').click();
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.locator('.checkout-page')).toBeVisible();
}

/** Submit order and wait for complete page */
export async function submitCheckout(page: Page) {
  const submit = page.locator('.checkout-submit-btn');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(/\/orders\/.+\/complete|\/complete/, { timeout: 30_000 });
}
