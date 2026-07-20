# 測試報告歸檔說明

面試要求附上「最近一次完整執行」的 HTML 報告或截圖。Playwright 預設輸出在 repo 根目錄 `playwright-report/`（已列入 `.gitignore`，避免每次跑測弄髒 git）。

## 建議交卷步驟

1. 設定受測網址並全量執行：

   **PowerShell**

   ```powershell
   $env:BASE_URL = "https://cand1.tail296b14.ts.net"
   # 若需要：$env:PLAYWRIGHT_BROWSERS_PATH = "D:\ms-playwright"
   npm test
   ```

2. 將報告複製到本目錄（可進 git、方便面試官 clone 後離線開）：

   **PowerShell**

   ```powershell
   New-Item -ItemType Directory -Force -Path docs/reports/latest | Out-Null
   Copy-Item -Recurse -Force playwright-report/* docs/reports/latest/
   ```

3. 本機預覽：用瀏覽器開啟 `docs/reports/latest/index.html`  
   或：`npx playwright show-report docs/reports/latest`

4. 在本檔下方「歸檔紀錄」補一行日期與摘要（passed／failed／expected fail）。

## 歸檔紀錄

| 日期 | 摘要 | 路徑 |
|---|---|---|
| 2026-07-20 | chromium 全量：**99 passed**（20.9m）；含 DEF `test.fail` 預期失敗案例。N-B01 已改動態讀取 D0 通知日期。 | `docs/reports/latest/` |
