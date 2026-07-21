/**
 * Shared golden pricing fixtures for C-A03 (API Primary) and C-B10 (Display).
 * Expected amounts are from PRD R-5.6 / R-2.x / R-5.x — do NOT recompute in Display tests.
 */

export type CartLine = { productName: string; quantity: number };

export type PricingExpect = {
  subtotal: number;
  bulkDiscount: number;
  couponDiscount: number;
  shipping: number;
  payable: number;
  couponName: string | null;
};

/** Display strings (R-2.8). Zero discount rows stay `NT$0` (no minus). */
export type PricingDisplay = {
  subtotal: string;
  bulkDiscount: string;
  couponDiscount: string;
  shipping: string;
  payable: string;
};

export type PricingCase = {
  id: string;
  title: string;
  cart: CartLine[];
  /** coupon code to send to preview / select on checkout; null = none */
  couponCode: string | null;
  expect: PricingExpect;
  display: PricingDisplay;
};

function nt(n: number): string {
  return `NT$${n.toLocaleString('en-US')}`;
}

function ntDiscount(n: number): string {
  return n === 0 ? 'NT$0' : `−${nt(n)}`;
}

function pack(e: PricingExpect): PricingDisplay {
  return {
    subtotal: nt(e.subtotal),
    bulkDiscount: ntDiscount(e.bulkDiscount),
    couponDiscount: ntDiscount(e.couponDiscount),
    shipping: nt(e.shipping),
    payable: nt(e.payable),
  };
}

/** R-5.6 example 1 */
export const CASE_R56_1: PricingCase = {
  id: 'CASE_R56_1',
  title: '咖啡濾杯×2 無券',
  cart: [{ productName: '手沖咖啡濾杯', quantity: 2 }],
  couponCode: null,
  expect: {
    subtotal: 960,
    bulkDiscount: 0,
    couponDiscount: 0,
    shipping: 60,
    payable: 1020,
    couponName: null,
  },
  display: pack({
    subtotal: 960,
    bulkDiscount: 0,
    couponDiscount: 0,
    shipping: 60,
    payable: 1020,
    couponName: null,
  }),
};

/** R-5.6 example 2 */
export const CASE_R56_2: PricingCase = {
  id: 'CASE_R56_2',
  title: '機械式鍵盤×1 無券',
  cart: [{ productName: '機械式鍵盤', quantity: 1 }],
  couponCode: null,
  expect: {
    subtotal: 3180,
    bulkDiscount: 159,
    couponDiscount: 0,
    shipping: 0,
    payable: 3021,
    couponName: null,
  },
  display: pack({
    subtotal: 3180,
    bulkDiscount: 159,
    couponDiscount: 0,
    shipping: 0,
    payable: 3021,
    couponName: null,
  }),
};

/** R-5.6 example 3 */
export const CASE_R56_3: PricingCase = {
  id: 'CASE_R56_3',
  title: '機械式鍵盤×1 + SAVE300',
  cart: [{ productName: '機械式鍵盤', quantity: 1 }],
  couponCode: 'SAVE300',
  expect: {
    subtotal: 3180,
    bulkDiscount: 159,
    couponDiscount: 300,
    shipping: 0,
    payable: 2721,
    couponName: '滿三千折三百券',
  },
  display: pack({
    subtotal: 3180,
    bulkDiscount: 159,
    couponDiscount: 300,
    shipping: 0,
    payable: 2721,
    couponName: null,
  }),
};

/** R-5.6 example 4 — half-up rounding 107.5 → 108 */
export const CASE_R56_4: PricingCase = {
  id: 'CASE_R56_4',
  title: '無線藍牙耳機×1 無券（四捨五入）',
  cart: [{ productName: '無線藍牙耳機', quantity: 1 }],
  couponCode: null,
  expect: {
    subtotal: 2150,
    bulkDiscount: 108,
    couponDiscount: 0,
    shipping: 0,
    payable: 2042,
    couponName: null,
  },
  display: pack({
    subtotal: 2150,
    bulkDiscount: 108,
    couponDiscount: 0,
    shipping: 0,
    payable: 2042,
    couponName: null,
  }),
};

/** R-5.2 free-ship coupon */
export const CASE_FREESHIP: PricingCase = {
  id: 'CASE_FREESHIP',
  title: 'T恤×1 + FREESHIP → 運費 0',
  cart: [{ productName: '純棉素色 T 恤', quantity: 1 }],
  couponCode: 'FREESHIP',
  expect: {
    subtotal: 400,
    bulkDiscount: 0,
    couponDiscount: 0,
    shipping: 0,
    payable: 400,
    couponName: '免運券',
  },
  display: pack({
    subtotal: 400,
    bulkDiscount: 0,
    couponDiscount: 0,
    shipping: 0,
    payable: 400,
    couponName: null,
  }),
};

/** Shipping tier &lt; 500 → 80 */
export const CASE_SHIP_LT500: PricingCase = {
  id: 'CASE_SHIP_LT500',
  title: '濾杯×1 折扣後 480 → 運費 80',
  cart: [{ productName: '手沖咖啡濾杯', quantity: 1 }],
  couponCode: null,
  expect: {
    subtotal: 480,
    bulkDiscount: 0,
    couponDiscount: 0,
    shipping: 80,
    payable: 560,
    couponName: null,
  },
  display: pack({
    subtotal: 480,
    bulkDiscount: 0,
    couponDiscount: 0,
    shipping: 80,
    payable: 560,
    couponName: null,
  }),
};

/** Closest achievable value above 500 with current A.1/A.2 fixtures: 690 − 20 = 670. */
export const CASE_SHIP_ABOVE_500: PricingCase = {
  id: 'CASE_SHIP_ABOVE_500',
  title: '保溫瓶 − NEWBIE20 → 折扣後 670 → 運費 60',
  cart: [{ productName: '不鏽鋼保溫瓶', quantity: 1 }],
  couponCode: 'NEWBIE20',
  expect: {
    subtotal: 690,
    bulkDiscount: 0,
    couponDiscount: 20,
    shipping: 60,
    payable: 730,
    couponName: '新人小禮券',
  },
  display: pack({
    subtotal: 690,
    bulkDiscount: 0,
    couponDiscount: 20,
    shipping: 60,
    payable: 730,
    couponName: null,
  }),
};

/** Closest achievable value below 1000: (480 + 690) − round(15%) = 994. */
export const CASE_SHIP_BELOW_1000: PricingCase = {
  id: 'CASE_SHIP_BELOW_1000',
  title: '濾杯＋保溫瓶 + PCT15 → 折扣後 994 → 運費 60',
  cart: [
    { productName: '手沖咖啡濾杯', quantity: 1 },
    { productName: '不鏽鋼保溫瓶', quantity: 1 },
  ],
  couponCode: 'PCT15',
  expect: {
    subtotal: 1170,
    bulkDiscount: 0,
    couponDiscount: 176,
    shipping: 60,
    payable: 1054,
    couponName: '全站 85 折券',
  },
  display: pack({
    subtotal: 1170,
    bulkDiscount: 0,
    couponDiscount: 176,
    shipping: 60,
    payable: 1054,
    couponName: null,
  }),
};

/** Closest achievable value below 2000: 2120 − 106 − 20 = 1994. */
export const CASE_SHIP_BELOW_2000: PricingCase = {
  id: 'CASE_SHIP_BELOW_2000',
  title: 'T恤＋蠟燭×2 − 滿額 − NEWBIE20 → 折扣後 1994 → 運費 30',
  cart: [
    { productName: '純棉素色 T 恤', quantity: 1 },
    { productName: '香氛蠟燭禮盒', quantity: 2 },
  ],
  couponCode: 'NEWBIE20',
  expect: {
    subtotal: 2120,
    bulkDiscount: 106,
    couponDiscount: 20,
    shipping: 30,
    payable: 2024,
    couponName: '新人小禮券',
  },
  display: pack({
    subtotal: 2120,
    bulkDiscount: 106,
    couponDiscount: 20,
    shipping: 30,
    payable: 2024,
    couponName: null,
  }),
};

/** Closest achievable value above 2000: 2130 − 107 − 20 = 2003. */
export const CASE_SHIP_ABOVE_2000: PricingCase = {
  id: 'CASE_SHIP_ABOVE_2000',
  title: '濾杯×3＋保溫瓶 − 滿額 − NEWBIE20 → 折扣後 2003 → 免運',
  cart: [
    { productName: '手沖咖啡濾杯', quantity: 3 },
    { productName: '不鏽鋼保溫瓶', quantity: 1 },
  ],
  couponCode: 'NEWBIE20',
  expect: {
    subtotal: 2130,
    bulkDiscount: 107,
    couponDiscount: 20,
    shipping: 0,
    payable: 2003,
    couponName: '新人小禮券',
  },
  display: pack({
    subtotal: 2130,
    bulkDiscount: 107,
    couponDiscount: 20,
    shipping: 0,
    payable: 2003,
    couponName: null,
  }),
};

/** Shipping tier 500–999 → 60 (R-5.6.1) */
export const CASE_SHIP_500_999: PricingCase = CASE_R56_1;

/** Shipping at exactly 1000 after NEWBIE20 → 30 */
export const CASE_SHIP_AT_1000: PricingCase = {
  id: 'CASE_SHIP_AT_1000',
  title: '露營椅 − NEWBIE20 → 折扣後 1000 → 運費 30',
  cart: [{ productName: '折疊露營椅', quantity: 1 }],
  couponCode: 'NEWBIE20',
  expect: {
    subtotal: 1020,
    bulkDiscount: 0,
    couponDiscount: 20,
    shipping: 30,
    payable: 1030,
    couponName: '新人小禮券',
  },
  display: pack({
    subtotal: 1020,
    bulkDiscount: 0,
    couponDiscount: 20,
    shipping: 30,
    payable: 1030,
    couponName: null,
  }),
};

/** Shipping tier ≥2000 after bulk → 0 */
export const CASE_SHIP_GE2000: PricingCase = CASE_R56_2;

/** Subtotal &lt; 2000 → bulk 0 */
export const CASE_NO_BULK: PricingCase = {
  id: 'CASE_NO_BULK',
  title: '濾杯×4 小計 1920 → 無滿額折扣',
  cart: [{ productName: '手沖咖啡濾杯', quantity: 4 }],
  couponCode: null,
  expect: {
    subtotal: 1920,
    bulkDiscount: 0,
    couponDiscount: 0,
    shipping: 30,
    payable: 1950,
    couponName: null,
  },
  display: pack({
    subtotal: 1920,
    bulkDiscount: 0,
    couponDiscount: 0,
    shipping: 30,
    payable: 1950,
    couponName: null,
  }),
};

/** R-4.6 threshold: SAVE100 ignored when subtotal &lt; 1000 */
export const CASE_COUPON_BELOW_THRESHOLD: PricingCase = {
  id: 'CASE_COUPON_BELOW_THRESHOLD',
  title: '濾杯×2 套用 SAVE100（未達門檻）→ 不折抵',
  cart: [{ productName: '手沖咖啡濾杯', quantity: 2 }],
  couponCode: 'SAVE100',
  expect: {
    subtotal: 960,
    bulkDiscount: 0,
    couponDiscount: 0,
    shipping: 60,
    payable: 1020,
    couponName: null,
  },
  display: pack({
    subtotal: 960,
    bulkDiscount: 0,
    couponDiscount: 0,
    shipping: 60,
    payable: 1020,
    couponName: null,
  }),
};

/** R-4.6: subtotal exactly equals PCT15 threshold 800 → should apply */
export const CASE_PCT15_AT_THRESHOLD: PricingCase = {
  id: 'CASE_PCT15_AT_THRESHOLD',
  title: 'T恤×2 小計恰=800 + PCT15（門檻邊界）',
  cart: [{ productName: '純棉素色 T 恤', quantity: 2 }],
  couponCode: 'PCT15',
  expect: {
    subtotal: 800,
    bulkDiscount: 0,
    couponDiscount: 120, // 800 × 15%
    shipping: 60,
    payable: 740,
    couponName: '全站 85 折券',
  },
  display: pack({
    subtotal: 800,
    bulkDiscount: 0,
    couponDiscount: 120,
    shipping: 60,
    payable: 740,
    couponName: null,
  }),
};

/** R-4.7: percent coupon on 商品小計, not after bulk */
export const CASE_PCT15_WITH_BULK: PricingCase = {
  id: 'CASE_PCT15_WITH_BULK',
  title: '機械式鍵盤×1 + PCT15（折抵基準＝小計）',
  cart: [{ productName: '機械式鍵盤', quantity: 1 }],
  couponCode: 'PCT15',
  expect: {
    subtotal: 3180,
    bulkDiscount: 159,
    couponDiscount: 477, // 3180 × 15%（非 3021 × 15%）
    shipping: 0,
    payable: 2544, // 3180 − 159 − 477
    couponName: '全站 85 折券',
  },
  display: pack({
    subtotal: 3180,
    bulkDiscount: 159,
    couponDiscount: 477,
    shipping: 0,
    payable: 2544,
    couponName: null,
  }),
};

/** Known-fail pricing (DEF-021 / DEF-023) — still asserted via test.fail */
export const PRICING_CASES_KNOWN_FAIL: { case: PricingCase; defect: string }[] = [
  {
    case: CASE_PCT15_WITH_BULK,
    defect: 'DEF-021: 折扣券折抵以滿額後金額為基準，非商品小計（R-4.7）；實際 couponDiscount=453',
  },
  {
    case: CASE_PCT15_AT_THRESHOLD,
    defect: 'DEF-023: 商品小計恰好等於門檻時券不可用（R-4.6）；PCT15@800 未折抵',
  },
];

/** All cases for C-A03 API table-driven tests */
export const PRICING_CASES_API: PricingCase[] = [
  CASE_R56_1,
  CASE_R56_2,
  CASE_R56_3,
  CASE_R56_4,
  CASE_FREESHIP,
  CASE_SHIP_LT500,
  CASE_SHIP_ABOVE_500,
  CASE_SHIP_BELOW_1000,
  CASE_SHIP_AT_1000,
  CASE_SHIP_BELOW_2000,
  CASE_SHIP_ABOVE_2000,
  CASE_NO_BULK,
  CASE_COUPON_BELOW_THRESHOLD,
];

/** Display secondary — at least the four R-5.6 examples */
export const PRICING_CASES_DISPLAY: PricingCase[] = [
  CASE_R56_1,
  CASE_R56_2,
  CASE_R56_3,
  CASE_R56_4,
];
