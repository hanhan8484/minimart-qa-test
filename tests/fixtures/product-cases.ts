export type ProductSeedCase = {
  name: string;
  category: string;
  unitPrice: number;
  stock: number;
};

/** PRD A.1 product seed golden fixture in required list order. */
export const A1_PRODUCTS: readonly ProductSeedCase[] = [
  { name: '手沖咖啡濾杯', category: '廚房', unitPrice: 480, stock: 12 },
  { name: '不鏽鋼保溫瓶', category: '廚房', unitPrice: 690, stock: 8 },
  { name: '極簡皮革錢包', category: '配件', unitPrice: 1280, stock: 5 },
  { name: '無線藍牙耳機', category: '3C', unitPrice: 2150, stock: 3 },
  { name: '純棉素色 T 恤', category: '服飾', unitPrice: 400, stock: 20 },
  { name: '陶瓷馬克杯', category: '廚房', unitPrice: 260, stock: 0 },
  { name: '折疊露營椅', category: '戶外', unitPrice: 1020, stock: 1 },
  { name: '香氛蠟燭禮盒', category: '居家', unitPrice: 860, stock: 6 },
  { name: '機械式鍵盤', category: '3C', unitPrice: 3180, stock: 4 },
];

export const PRODUCT_ORDER = A1_PRODUCTS.map((product) => product.name);
export const SOLD_OUT_PRODUCT = '陶瓷馬克杯';
