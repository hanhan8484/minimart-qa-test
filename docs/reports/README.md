# 測試報告歸檔說明

面試要求附上「最近一次完整執行」的 HTML 報告或截圖。Playwright 預設輸出在 repo 根目錄 `playwright-report/`（已列入 `.gitignore`，避免每次跑測弄髒 git）。

## 建議交卷步驟

1. 設定受測網址並全量執行（**勿把真實 `BASE_URL` 寫進公開 repo**）：

   **PowerShell**

   ```powershell
   $env:BASE_URL = "https://<your-minimart-host>"
   # 若需要：$env:PLAYWRIGHT_BROWSERS_PATH = "D:\ms-playwright"
   npm test
   ```

   變數說明見根目錄 [`.env.example`](../../.env.example) 與 [`README.md`](../../README.md)。

2. 將報告複製到本目錄（可進 git、方便面試官 clone 後離線開）：

   **PowerShell**

   ```powershell
   New-Item -ItemType Directory -Force -Path docs/reports/latest | Out-Null
   Copy-Item -Recurse -Force playwright-report/* docs/reports/latest/
   New-Item -ItemType Directory -Force -Path docs/reports/executive | Out-Null
   Copy-Item -Recurse -Force executive-report/* docs/reports/executive/
   ```

3. 本機預覽：用瀏覽器開啟 `docs/reports/latest/index.html`
   或：`npx playwright show-report docs/reports/latest`
   管理摘要：開啟 `docs/reports/executive/index.html`

4. 在本檔下方「歸檔紀錄」補一行日期與摘要（passed／failed／expected fail）。

## Executive report（管理型摘要）

每次 Playwright 執行結束時，`tests/reporters/executive-reporter.ts` 會自動產生：

- `executive-report/index.html`：給 reviewer／PM／release decision 使用
- `executive-report/summary.json`：供 CI 或後續統計使用

報告不沿用 Playwright 容易誤解的單一 `passed` 數字，而是分開顯示：

- Normal pass
- Expected failure／known-defect evidence（同時列出 unique DEF）
- Skipped／blocked
- Unexpected failure
- Fix candidate（原 `test.fail` 現在通過）
- Flaky

> Playwright 原生 HTML 保留作 step-level debugging；Executive report 用於判斷產品狀態，兩者不可互相取代。

## 歸檔紀錄

| 日期 | 摘要 | 路徑 |
|---|---|---|
| 2026-07-22 | Executive 全量：**84 normal pass、36 expected failure、3 skipped、0 unexpected failure**（123 total，~20.5m）；commit `36a4b9bf0834`；Playwright status `passed`。 | `docs/reports/executive/` |
| 2026-07-22 | chromium 全量：**120 passed、3 skipped（123 total）**（~20.5m）；0 unexpected failures，含 DEF `test.fail` 預期失敗案例。 | `docs/reports/latest/` |
| 2026-07-21 | Executive reporter 驗證全量：**78 normal pass、34 expected failure、10 skipped／blocked、1 unexpected failure**（123 total，20.5m）；unexpected failure 導致同一 serial 區段後續 7 cases 未執行。 | `docs/reports/executive/` |
| 2026-07-21 | chromium 全量：**120 passed、3 skipped（123 total）**（19.4m）；0 unexpected failures，含 DEF `test.fail` 預期失敗案例。 | `docs/reports/latest/` |
