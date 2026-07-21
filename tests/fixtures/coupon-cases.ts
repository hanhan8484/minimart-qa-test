export type CouponSeedCase = {
  code: string;
  name: string;
  type: 'FIXED' | 'PCT' | 'FREESHIP';
  value: number;
  threshold: number;
  expiresInDays: number;
  status: '未使用' | '已過期';
};

/** PRD A.2 account seed coupon golden fixture. */
export const A2_COUPONS: readonly CouponSeedCase[] = [
  {
    code: 'NEWBIE20',
    name: '新人小禮券',
    type: 'FIXED',
    value: 20,
    threshold: 0,
    expiresInDays: 180,
    status: '未使用',
  },
  {
    code: 'SAVE100',
    name: '滿千折百券',
    type: 'FIXED',
    value: 100,
    threshold: 1000,
    expiresInDays: 180,
    status: '未使用',
  },
  {
    code: 'SAVE300',
    name: '滿三千折三百券',
    type: 'FIXED',
    value: 300,
    threshold: 3000,
    expiresInDays: 180,
    status: '未使用',
  },
  {
    code: 'PCT15',
    name: '全站 85 折券',
    type: 'PCT',
    value: 0.15,
    threshold: 800,
    expiresInDays: 180,
    status: '未使用',
  },
  {
    code: 'FREESHIP',
    name: '免運券',
    type: 'FREESHIP',
    value: 0,
    threshold: 0,
    expiresInDays: 180,
    status: '未使用',
  },
  {
    code: 'EXPIRED50',
    name: '舊版折五十券',
    type: 'FIXED',
    value: 50,
    threshold: 0,
    expiresInDays: -30,
    status: '已過期',
  },
];

/** Format a PRD D0-relative date as YYYY-MM-DD. */
export function dateFromD0(offsetDays: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
