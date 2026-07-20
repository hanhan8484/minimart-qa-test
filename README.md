# MiniMart QA — Playwright 自動化測試

針對 **MiniMart v2.1**（行為依據見根目錄 [`PRD.md`](./PRD.md)）的 Playwright 端對端／API 測試專案。  
面試／收卷交付：自動化 repo、缺陷報告、測試策略、AI 相關文件皆在本倉庫。

## 文件地圖

| 用途 | 位置 |
|---|---|
| 規格（唯一行為依據） | [`PRD.md`](./PRD.md)（v2.1；含訂單備註） |
| v2.1 原文增補稿（來源留存） | [`docs/PRD-v2.1-supplement.docx`](./docs/PRD-v2.1-supplement.docx) |
| 測試策略決策 v2 | [`docs/test-strategy-v2.md`](./docs/test-strategy-v2.md) |
| 規則→案例細表 | [`docs/minimar-qa-test.md`](./docs/minimar-qa-test.md) |
| 缺陷報告 | [`docs/defects.md`](./docs/defects.md) |
| v2.1 迴歸報告（含 RD Changelog 對照） | [`docs/v2.1-regression-report.md`](./docs/v2.1-regression-report.md) |
| AI 使用心得 | [`docs/ai-usage-reflection.md`](./docs/ai-usage-reflection.md) |
| AI 報告檢視標註 | [`docs/ai-report-review.md`](./docs/ai-report-review.md) |
| AI 報告原文（標的） | [`docs/ai-test-report-v2.0.md`](./docs/ai-test-report-v2.0.md) |
| 測試 HTML 報告歸檔 | [`docs/reports/latest/`](./docs/reports/latest/) |

---

## 環境需求

- Node.js 18+（建議 LTS）
- npm
- 可連線至受測站（預設 Tailscale 網址，見下方 `BASE_URL`）

---

## 安裝（一鍵前置）

```bash
npm install
npx playwright install chromium
```

> Windows 若 C 槽空間不足，可先指定瀏覽器路徑再安裝／執行：  
> PowerShell：`$env:PLAYWRIGHT_BROWSERS_PATH = "D:\ms-playwright"`

---

## 怎麼跑（收卷用）

### 全量（推薦收卷前跑一次）

**PowerShell**

```powershell
$env:BASE_URL = "https://cand1.tail296b14.ts.net"
npm test
```

**bash / macOS / Linux**

```bash
BASE_URL=https://cand1.tail296b14.ts.net npm test
```

跑完後：

```bash
npm run test:report
```

瀏覽器會開 Playwright HTML 報告（預設 `http://localhost:9323`）。  
若要歸檔到 repo（給面試官離線看），見 [`docs/reports/README.md`](./docs/reports/README.md)。

### 只跑某一層

| 指令 | 內容 |
|---|---|
| `npm test` | 全量 chromium |
| `npm run test:api-a` | API（Type A） |
| `npm run test:batch-b` | 部分 UI（Type B） |
| `npm run test:batch1` … `test:batch10` | 依批次腳本 |

單一檔案：

```bash
npx playwright test tests/flows/c-checkout-success.spec.ts --project=chromium
```

---

## 設定值（測試合約）

| 變數 | 用途 | 預設 |
|---|---|---|
| **`BASE_URL`** | 受測網站根網址 | `https://cand1.tail296b14.ts.net` |
| `RESET_URL` | 環境重置（Day-0 seed） | `{BASE 同源}/reset-4712a2d2`（見 `tests/helpers/constants.ts`） |
| `TEST_USER` / `TEST_PASS` | 測試帳號 | `demo@minimart.test` / `demo1234` |

設定寫在 `playwright.config.ts` 的 `use.baseURL`，**收卷後請用你們的環境覆寫 `BASE_URL` 再跑**。

重置行為：多數套件在 `beforeAll` 呼叫 `resetEnv()`（GET reset → 等約 5 秒 → **登入並檢查 A.4 三筆種子訂單**；若種子未還原會立刻失敗並提示環境髒掉，避免後面 serial 連坐）。若你們的 reset 路徑不同，請設 `RESET_URL`。

---

## 測試怎麼組織

```
tests/
  api/       # Type A — 後端 API
  ui/        # Type B — 單頁 UI
  flows/     # Type C — 跨頁流程
  helpers/   # 登入、reset、購物車、結帳、訂單
  fixtures/  # pricing golden cases
docs/
  defects.md
  test-strategy-v2.md
  v2.1-regression-report.md
  reports/latest/   # 歸檔 HTML 報告
```

- **UI 自動化 = must have**（`tests/ui` + `tests/flows`）
- **API 自動化 = nice to have**（`tests/api`）
- 案例 ID（如 `C-C02`、`O-B01`）對應策略文件與缺陷報告中的「自動化處理」欄
- 已知未修缺陷以 Playwright `test.fail(true, 'DEF-xxx…')` 鎖定；**修復後應移除**該行，讓斷言變成真正回歸閘門

Workers：`playwright.config.ts` 設 `workers: 1`（遠端共用 SUT，避免 reset／登入互相踩踏）。

---

## 最近一次執行報告

請見 [`docs/reports/latest/index.html`](./docs/reports/latest/index.html)。

歸檔步驟見 [`docs/reports/README.md`](./docs/reports/README.md)。

---

## 缺陷與已知失敗怎麼看

- 清單：[`docs/defects.md`](./docs/defects.md)
- 全量跑可能「多數 passed」，但其中含 **expected fail**（`test.fail`）＝缺陷仍在
- 若出現 *Expected to fail, but passed* → 該 DEF 可能已修，應更新缺陷狀態並刪除 `test.fail`

---

## Git 紀錄

本 repo 保留分批 commit（策略 → batch1… → API → DEF 補強），請勿 squash 成單次提交後再交卷。
