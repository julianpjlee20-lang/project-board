# Project Board - 專案指令

## 專案概覽
團隊專案管理看板系統（Kanban Board）。
- **技術棧**：Next.js 16 + React 19 + TypeScript + PostgreSQL + Tailwind 4
- **套件管理**：pnpm（workspace 架構）
- **拖放**：@hello-pangea/dnd
- **驗證**：Zod
- **部署**：Zeabur
- **Windows 注意**：dev server 需用 `--webpack` flag（Turbopack 在 Windows 有 bug）

## Session 啟動檢查表
每次新 session 開始時，**依序閱讀**：
1. ✅ 本檔案（自動載入）
2. 📋 `docs/TODO.md` — 查看當前任務清單，確認從哪個任務繼續
3. 📄 `docs/PRD.md` — 需要功能細節時再讀

## 檔案導覽
| 檔案 | 用途 | 版本控制 |
|------|------|----------|
| `docs/PRD.md` | 功能需求規格、決策記錄、資料架構 | 是 |
| `docs/TODO.md` | 當前任務 checkbox 清單 | 是 |
| `PROJECT_PROGRESS.md` | 已完成工作的詳細操作日誌 | 否 |
| `TESTING.md` | 測試指南 | 是 |
| `e2e-test-report.md` | E2E 測試報告（已測旅程、發現問題、截圖索引） | 否 |

## 關鍵路徑
| 用途 | 路徑 |
|------|------|
| API 路由 | `src/app/api/` |
| Zod 驗證 | `src/lib/validations.ts` |
| DB 連線 | `src/lib/db.ts` |
| 主頁面 | `src/app/projects/[id]/page.tsx` |
| 類型定義 | `src/app/projects/[id]/types.ts` |
| 視圖元件 | `src/app/projects/[id]/views.tsx` |

## 開發命令
```bash
pnpm run dev        # 啟動 dev server（--webpack）
pnpm run build      # 建置
pnpm test           # Cypress E2E 測試
pnpm run lint       # ESLint
npx playwright test # Playwright E2E 回歸測試（tests/e2e/）
```

## E2E 測試
- 執行 `/e2e-test` 前，**先讀 `e2e-test-report.md`** 了解已完成的測試旅程，避免重複
- Playwright 回歸測試：`tests/e2e/`（7 檔案 / 20 測試案例）
- 截圖存放：`e2e-screenshots/`

## 開發規範
- API 輸入一律使用 Zod 驗證
- 錯誤處理：try-catch + 檢查 res.ok
- 資料庫：參數化查詢（防 SQL Injection）
- Git 提交：語義化訊息（新增:/修復:/更新:/重構:）

## 工作完成時
1. 更新 `docs/TODO.md`（打勾完成的任務）
2. 將詳細操作記錄寫入 `PROJECT_PROGRESS.md`
3. 踩坑經驗記錄到 `memory/pitfalls.md`
