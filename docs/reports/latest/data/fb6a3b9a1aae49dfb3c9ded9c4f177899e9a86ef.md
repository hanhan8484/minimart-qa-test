# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flows\o-return-reject-revoke.spec.ts >> O-C05 revoke return application >> revoke dialog → 無退貨／已完成
- Location: tests\flows\o-return-reject-revoke.spec.ts:104:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: '撤銷退貨申請' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: '撤銷退貨申請' })

```

```yaml
- banner:
  - link "MiniMart":
    - /url: /
  - navigation:
    - link "商品":
      - /url: /
    - link "購物車":
      - /url: /cart
    - link "我的訂單":
      - /url: /orders
    - link "我的優惠卷":
      - /url: /coupons
    - link "通知中心 4":
      - /url: /notifications
    - text: demo@minimart.test
    - button "登出"
- main:
  - heading "訂單詳情" [level=1]
  - heading "訂單資訊" [level=2]
  - text: 訂單編號 MM-20260715-0001 下單時間 2026-07-15 09:40 訂單狀態 退貨中 預計出貨日 2026-07-17
  - heading "商品明細" [level=2]
  - text: 香氛蠟燭禮盒 NT$860 x1 NT$860 純棉素色 T 恤 NT$400 x1 NT$400
  - heading "金額摘要" [level=2]
  - text: 商品小計 NT$1,260 滿額折扣 NT$0 優惠券折抵 NT$0 運費 NT$30 應付金額 NT$1,290
  - heading "收件資訊" [level=2]
  - text: 收件人姓名 測試收件人 2 手機號碼 0923456789 收件地址 台北市信義區忠孝東路四段 1 號
  - heading "訂單備註" [level=2]
  - paragraph: （無備註）
  - heading "狀態與操作" [level=2]
  - list:
    - listitem: 待審核 2026-07-21 21:09
  - button "賣家審核（Demo）"
```

# Test source

```ts
  17  |  */
  18  | test.describe.serial('O-C04 return reject and re-apply', () => {
  19  |   test.beforeAll(async ({ request }) => {
  20  |     test.setTimeout(60_000);
  21  |     await resetEnv(request);
  22  |   });
  23  | 
  24  |   test('short reason → 賣家審核 → 已駁回／已完成 + 可再申請', async ({ page }) => {
  25  |     test.setTimeout(90_000);
  26  |     await loginAsDemo(page);
  27  |     await openOrderDetail(page, seedCompletedId());
  28  |     await page.getByRole('button', { name: '申請退貨' }).click();
  29  | 
  30  |     await page.locator('textarea').fill(SHORT_REASON);
  31  |     await page.getByRole('button', { name: '送出申請' }).click();
  32  |     await expect(page).toHaveURL(new RegExp(`/orders/${seedCompletedId()}$`));
  33  |     await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible({ timeout: 30_000 });
  34  |     await expect.poll(async () => getDetailStatusText(page), { timeout: 30_000 }).toBe('退貨中');
  35  | 
  36  |     await Promise.all([
  37  |       page.waitForResponse(
  38  |         (r) =>
  39  |           r.request().method() === 'POST' &&
  40  |           r.url().includes(`/api/orders/${seedCompletedId()}/returns/review`) &&
  41  |           r.ok(),
  42  |       ),
  43  |       page.getByRole('button', { name: '賣家審核（Demo）' }).click(),
  44  |     ]);
  45  | 
  46  |     await openOrderDetail(page, seedCompletedId());
  47  |     await expect.poll(async () => getDetailStatusText(page)).toBe('已完成');
  48  |     await expect(page.getByText(`駁回原因：${REJECT_MSG}`)).toBeVisible();
  49  |     await expect(page.getByRole('button', { name: '申請退貨' })).toBeVisible();
  50  | 
  51  |     const api = await page.evaluate(async (oid) => {
  52  |       const o = await fetch(`/api/orders/${oid}`, { credentials: 'include' }).then((r) => r.json());
  53  |       return {
  54  |         returnStatus: o.returnStatus,
  55  |         returnRejectReason: o.returnRejectReason,
  56  |         timeline: (o.returnTimeline || []).map((x: { status: string }) => x.status),
  57  |         canApplyReturn: o.canApplyReturn,
  58  |       };
  59  |     }, seedCompletedId());
  60  |     expect(api.returnStatus).toBe('已駁回');
  61  |     expect(api.returnRejectReason).toBe(REJECT_MSG);
  62  |     expect(api.timeline).toEqual(expect.arrayContaining(['待審核', '已駁回']));
  63  |     expect(api.canApplyReturn).toBe(true);
  64  | 
  65  |     // R-8.5 reject notification (API — UI 列表偶發長時間「載入中」)
  66  |     const titles = await page.evaluate(async () => {
  67  |       const list = await fetch('/api/notifications', { credentials: 'include' }).then((r) =>
  68  |         r.json(),
  69  |       );
  70  |       return list.map((n: { title: string }) => n.title);
  71  |     });
  72  |     expect(titles).toContain(`訂單 ${seedCompletedId()} 的退貨申請已駁回`);
  73  |   });
  74  | 
  75  |   test('re-apply after reject → 再次進入待審核', async ({ page }) => {
  76  |     test.setTimeout(60_000);
  77  |     await loginAsDemo(page);
  78  |     await openOrderDetail(page, seedCompletedId());
  79  |     await expect(page.getByText(`駁回原因：${REJECT_MSG}`)).toBeVisible();
  80  | 
  81  |     await page.getByRole('button', { name: '申請退貨' }).click();
  82  |     await expect(page).toHaveURL(new RegExp(`/orders/${seedCompletedId()}/return`));
  83  |     await page.locator('textarea').fill(LONG_REASON);
  84  |     await page.getByRole('button', { name: '送出申請' }).click();
  85  | 
  86  |     await expect(page).toHaveURL(new RegExp(`/orders/${seedCompletedId()}$`));
  87  |     await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible({ timeout: 30_000 });
  88  |     await expect.poll(async () => getDetailStatusText(page), { timeout: 30_000 }).toBe('退貨中');
  89  |     await expect(page.getByRole('button', { name: '賣家審核（Demo）' })).toBeVisible();
  90  |     await expect(page.locator('.return-timeline-status', { hasText: '待審核' }).last()).toBeVisible();
  91  |   });
  92  | });
  93  | 
  94  | /**
  95  |  * Batch 7 — O-C05 revoke return application
  96  |  * R-7.12 — blocked by DEF-005 (no revoke button)
  97  |  */
  98  | test.describe('O-C05 revoke return application', () => {
  99  |   test.beforeAll(async ({ request }) => {
  100 |     test.setTimeout(60_000);
  101 |     await resetEnv(request);
  102 |   });
  103 | 
  104 |   test('revoke dialog → 無退貨／已完成', async ({ page }) => {
  105 |     test.setTimeout(90_000);
  106 |     test.fail(true, 'DEF-005: 待審核無「撤銷退貨申請」按鈕，O-C05 無法執行（R-7.12）');
  107 | 
  108 |     await loginAsDemo(page);
  109 |     await openOrderDetail(page, seedCompletedId());
  110 |     await page.getByRole('button', { name: '申請退貨' }).click();
  111 |     await page.locator('textarea').fill('準備撤銷的退貨申請');
  112 |     await page.getByRole('button', { name: '送出申請' }).click();
  113 |     await expect(page.getByRole('heading', { name: '訂單詳情' })).toBeVisible({ timeout: 30_000 });
  114 |     await expect.poll(async () => getDetailStatusText(page), { timeout: 30_000 }).toBe('退貨中');
  115 | 
  116 |     // Fail fast on missing control (DEF-005); full dialog path encoded below for when fixed
> 117 |     await expect(page.getByRole('button', { name: '撤銷退貨申請' })).toBeVisible();
      |                                                                ^ Error: expect(locator).toBeVisible() failed
  118 |     await page.getByRole('button', { name: '撤銷退貨申請' }).click();
  119 |     await expect(page.getByText('確定要撤銷這次退貨申請嗎？')).toBeVisible();
  120 |     await page.getByRole('button', { name: '確定' }).click();
  121 | 
  122 |     await expect.poll(async () => getDetailStatusText(page), { timeout: 30_000 }).toBe('已完成');
  123 |     const api = await page.evaluate(async (oid) => {
  124 |       const o = await fetch(`/api/orders/${oid}`, { credentials: 'include' }).then((r) => r.json());
  125 |       return o.returnStatus;
  126 |     }, seedCompletedId());
  127 |     expect(api).toBe('無退貨');
  128 |   });
  129 | });
  130 | 
```