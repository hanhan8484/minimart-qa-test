import type { APIRequestContext } from '@playwright/test';

export async function clearCartRequest(request: APIRequestContext) {
  const cart = await (await request.get('/api/cart')).json();
  for (const item of cart.items || []) {
    const res = await request.delete(`/api/cart/items/${item.productId}`);
    if (!res.ok()) throw new Error(`clear cart failed ${res.status()}`);
  }
}

export async function addCartItem(
  request: APIRequestContext,
  productId: number,
  quantity: number,
) {
  const res = await request.post('/api/cart/items', {
    data: { productId, quantity },
  });
  if (!res.ok()) throw new Error(`add cart failed ${res.status()} ${await res.text()}`);
  return res.json();
}

export async function getProducts(request: APIRequestContext) {
  const res = await request.get('/api/products');
  if (!res.ok()) throw new Error(`products ${res.status()}`);
  return res.json() as Promise<
    { id: number; name: string; category: string; unitPrice: number; stock: number }[]
  >;
}

export async function checkoutViaApi(
  request: APIRequestContext,
  data: {
    recipientName: string;
    phone: string;
    address: string;
    couponCode?: string | null;
  },
) {
  const body: Record<string, unknown> = {
    recipientName: data.recipientName,
    phone: data.phone,
    address: data.address,
  };
  if (data.couponCode) body.couponCode = data.couponCode;
  return request.post('/api/checkout', { data: body });
}

export const DEFAULT_API_SHIPPING = {
  recipientName: 'API測試收件',
  phone: '0912345678',
  address: '台北市信義區測試路一段100號',
};
