/** Shared MiniMart test credentials and URLs */
export const DEMO_EMAIL = process.env.TEST_USER || 'demo@minimart.test';
export const DEMO_PASSWORD = process.env.TEST_PASS || 'demo1234';

export const DEFAULT_RESET_URL =
  process.env.RESET_URL || 'https://cand1.tail296b14.ts.net/reset-4712a2d2';

/** Appendix A.1 product names in list order (Day-0) */
export const PRODUCT_ORDER = [
  '手沖咖啡濾杯',
  '不鏽鋼保溫瓶',
  '極簡皮革錢包',
  '無線藍牙耳機',
  '純棉素色 T 恤',
  '陶瓷馬克杯',
  '折疊露營椅',
  '香氛蠟燭禮盒',
  '機械式鍵盤',
] as const;

export const SOLD_OUT_PRODUCT = '陶瓷馬克杯';
