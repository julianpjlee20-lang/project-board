# 開發任務清單

## 當前階段：Phase + 子任務 Checklist + 優先度 + 卡片 UI 強化
**狀態：已完成 ✅**
**需求規格：** [PRD.md](PRD.md)

---

### 後端
- [x] 1. DB migration — phases 表 + cards 加 phase_id, priority (`src/app/api/projects/route.ts`)
- [x] 2. Phase API CRUD (`src/app/api/projects/[id]/phases/route.ts` 新檔案)
- [x] 3. validations.ts 更新 — updateCardSchema 加 priority, phase_id + phase schemas (`src/lib/validations.ts`)
- [x] 4. cards PUT API 支援 priority, phase_id + activity log (`src/app/api/cards/[id]/route.ts`)
- [x] 5. columns GET API 加入 subtasks, tags, phase_id, priority (`src/app/api/projects/[id]/columns/route.ts`)

### 前端
- [x] 6. types.ts 更新 — Card 加 priority, phase_id + Phase interface (`src/app/projects/[id]/types.ts`)
- [x] 7. Phase 篩選 Tab + 管理 UI (`src/app/projects/[id]/page.tsx`)
- [x] 8. CardModal 子任務 Checklist (`src/app/projects/[id]/page.tsx`)
- [x] 9. CardModal 優先度 + 階段 + 標籤 + 進度 (`src/app/projects/[id]/page.tsx`)
- [x] 10. CardItem 強化 — 優先度標記 + Phase 標籤 + 子任務預覽 (`src/app/projects/[id]/page.tsx`)
- [x] 11. ListView 更新 — 加 Phase, Priority 欄位 (`src/app/projects/[id]/views.tsx`)

---

## 當前階段：Calendar 視圖增強 — 月/季/年切換 + 導航
**狀態：已完成 ✅**
**計畫檔：** `~/.claude/plans/partitioned-skipping-bentley.md`

### 前端
- [x] 1. 型別更新 — 新增 `CalendarMode` 型別 (`src/app/projects/[id]/types.ts`)
- [x] 2. 重構 CalendarView → MonthView 子元件，year/month 改由 props 傳入 + 今天高亮 + 共用 `getMonthData()` (`src/app/projects/[id]/views.tsx`)
- [x] 3. 新 CalendarView 主容器 — Toolbar（導航按鈕 + 標題 + 月/季/年 Tab）+ state 管理 (`src/app/projects/[id]/views.tsx`)
- [x] 4. QuarterView — 3 欄迷你月曆 + 彩色圓點 + hover tooltip (`src/app/projects/[id]/views.tsx`)
- [x] 5. YearView — 12 月熱力圖概覽 + 點擊月份跳轉 (`src/app/projects/[id]/views.tsx`)
- [x] 6. UI 打磨 — 響應式、aria-label、今天按鈕回饋

---

## Auth：帳密登入 + Discord OAuth
**狀態：已完成 ✅**

- [x] 1. 安裝 bcryptjs 依賴
- [x] 2. `src/auth.ts` — Credentials + Discord provider（雙登入模式）
- [x] 3. `src/app/api/auth/register/route.ts` — 註冊 API（Zod 驗證 + bcrypt）
- [x] 4. `src/lib/validations.ts` — 新增 `registerSchema`
- [x] 5. `src/app/login/page.tsx` — 帳密表單 + Discord 按鈕
- [x] 6. Discord OAuth 已測試通過 ✅
- [x] 7. Build 驗證 ✅

---

## Bug Fixes
**狀態：已完成 ✅**

- [x] 登入 AccessDenied — 自動建立 profiles 表 + 錯誤處理 (`e9bfb7f`)
- [x] Discord 登入 403 — 補上既有 profiles 表缺少的欄位 (`64a4307`)
- [x] 進度顯示 undefined% + 進度視圖永遠 0% (`7d135ec`)
- [x] zeabur.json 改用 pnpm（與專案一致）(`abbf07c`)

---

## 當前階段：使用者設定 + Admin CMS + 帳號審核
**狀態：已完成 ✅**
**計畫檔：** `~/.claude/plans/crystalline-greeting-bumblebee.md`

### Phase 1：資料庫 + 認證基礎 ✅
- [x] 1. profiles 表新增 role / is_active / updated_at 欄位 (`src/auth.ts`)
- [x] 2. ADMIN_EMAIL 環境變數機制 — 自動設定管理員 (`src/auth.ts`)
- [x] 3. JWT / Session 型別擴展加 role (`src/types/next-auth.d.ts`)
- [x] 4. Auth callbacks — authorize 檢查 is_active、jwt/session 傳遞 role (`src/auth.ts`)
- [x] 5. requireAuth() / requireAdmin() 輔助函數 (`src/lib/auth.ts`)
- [x] 6. 註冊 API — is_active=false + 審核訊息 (`src/app/api/auth/register/route.ts`)
- [x] 7. 登入頁 — 移除略過登入、加審核提示 (`src/app/login/page.tsx`)
- [x] 8. Zod schema — updateProfileSchema / changePasswordSchema / adminUpdateUserSchema (`src/lib/validations.ts`)

### Phase 2：路由保護 ✅
- [x] 9. Middleware（proxy.ts）— 公開/認證/admin 三級路由保護 (`src/proxy.ts`)

### Phase 3：使用者設定 API ✅
- [x] 10. GET/PUT /api/users/me — 個人資料 CRUD (`src/app/api/users/me/route.ts`)
- [x] 11. PUT /api/users/me/password — 更改密碼 (`src/app/api/users/me/password/route.ts`)

### Phase 4：Admin CMS API ✅
- [x] 12. GET /api/admin/stats — 系統統計 (`src/app/api/admin/stats/route.ts`)
- [x] 13. GET /api/admin/users — 使用者列表 + 搜尋/篩選/分頁 (`src/app/api/admin/users/route.ts`)
- [x] 14. GET/PATCH /api/admin/users/[id] — 使用者詳情/編輯 (`src/app/api/admin/users/[id]/route.ts`)
- [x] 15. GET /api/admin/projects — 專案概覽 (`src/app/api/admin/projects/route.ts`)

### Phase 3 前端：使用者設定頁面 ✅
- [x] 16. Settings 頁面 — 個人資料/更改密碼/已連結帳號/通知偏好 (`src/app/settings/page.tsx`)

### Phase 4 前端：Admin CMS 頁面 ✅
- [x] 17. Admin Layout — Sidebar 導航 (`src/app/admin/layout.tsx`)
- [x] 18. Admin Dashboard — 統計卡片 (`src/app/admin/page.tsx`)
- [x] 19. 使用者列表 — 搜尋/篩選/啟用停用 (`src/app/admin/users/page.tsx`)
- [x] 20. 使用者詳情 — 編輯 role/is_active (`src/app/admin/users/[id]/page.tsx`)
- [x] 21. 專案概覽 — 專案列表表格 (`src/app/admin/projects/page.tsx`)

### Phase 5：整合 ✅
- [x] 22. SessionProvider 加入 root layout (`src/app/layout.tsx`)
- [x] 23. UserNav 元件 — 右上角使用者選單 (`src/components/UserNav.tsx`)
- [x] 24. 整合 UserNav 到 projects 頁面
- [x] 25. Build 驗證 + 功能測試

---

## 預計完成日 + 實際完成日 — 時間軸視覺化
**狀態：已完成 ✅**
**計畫檔：** `~/.claude/plans/federated-prancing-sutherland.md`

### Phase 1：資料層 ✅
- [x] 1. DB migration — cards 加 planned_completion_date, actual_completion_date (`src/app/api/projects/route.ts`)
- [x] 2. TypeScript 類型更新 — Card +2 欄位 + created_at (`src/app/projects/[id]/types.ts`)
- [x] 3. Zod 驗證 — updateCardSchema +2 日期驗證 (`src/lib/validations.ts`)
- [x] 4. cards PUT API 支援新欄位 + activity log (`src/app/api/cards/[id]/route.ts`)
- [x] 5. columns GET 確認包含新欄位 (`src/app/api/projects/[id]/columns/route.ts`)

### Phase 2+3+4：前端 page.tsx ✅
- [x] 6. CardModal 日程安排區塊 — 三日期行 + 時間軸條 + 動態摘要 (`src/app/projects/[id]/page.tsx`)
- [x] 7. CardItem MiniTimelineBar — 4px hover→8px + tooltip (`src/app/projects/[id]/page.tsx`)
- [x] 8. onDragEnd 拖放自動化 — 拖到最後欄自動填入實際完成日 + 回滾機制 (`src/app/projects/[id]/page.tsx`)

### Phase 5+6：前端 views.tsx ✅
- [x] 9. ListView 日程欄 — 迷你時間軸條 + hover tooltip (`src/app/projects/[id]/views.tsx`)
- [x] 10. CalendarView 多日期標記 — ●截止/○預計/◉實際 + 圖例 (`src/app/projects/[id]/views.tsx`)
- [x] 11. Build 驗證通過 ✅

---

## 甘特圖視圖 + Card start_date
**狀態：已完成 ✅**
**計畫檔：** `~/.claude/plans/async-questing-wind.md`

### Phase 1：資料層 ✅
- [x] 1. DB migration — cards 加 start_date (`src/app/api/projects/route.ts`, `tests/global-setup.ts`)
- [x] 2. TypeScript 類型更新 — ViewType + GanttScale + Card.start_date (`src/app/projects/[id]/types.ts`)
- [x] 3. Zod 驗證 — updateCardSchema + start_date + 跨欄位驗證 (`src/lib/validations.ts`)
- [x] 4. cards PUT API 支援 start_date + activity log (`src/app/api/cards/[id]/route.ts`)

### Phase 2：前端 ✅
- [x] 5. CardModal 新增開始日欄位 (`src/app/projects/[id]/page.tsx`)
- [x] 6. CardItem 日期顯示增強 — 開始日 ~ 截止日 (`src/app/projects/[id]/page.tsx`)
- [x] 7. GanttView 甘特圖元件 — 完整實作 (`src/app/projects/[id]/gantt.tsx`)
- [x] 8. 主頁面整合 — viewTabs + 渲染 (`src/app/projects/[id]/page.tsx`)
- [x] 9. Build 驗證通過 ✅

---

## 待開發功能

### 應用內通知中心 + Admin 通知管理
**狀態：已完成 ✅**

- [x] 通知中心頁面 `/notifications` — 逾期 / 即將到期 / 近期變更 / 專案進度（即時查詢）
- [x] `GET /api/notifications/center` — 通知中心 API
- [x] Admin 通知管理 `/admin/notifications` — 老闆設定 + 摘要內容 Toggle + 手動觸發測試
- [x] `GET/PUT /api/admin/notifications/settings` + Zod 驗證
- [x] DB: `notification_settings` 表 + `profiles` 新增 `line_display_name`、`line_picture_url` 欄位
- [x] 統一通知分發器 (`src/lib/notifications.ts`)
- [x] 通知偏好 CRUD (`src/app/api/notifications/preferences/route.ts`)

### AI API 基礎設施（外部整合用）
**狀態：已完成 ✅**

- [x] `src/lib/api-key.ts` — API Key 生成 + SHA-256 hash 工具函式
- [x] `src/lib/api-key-guard.ts` — 權限檢查（read_only / full / admin JWT only）
- [x] `src/lib/rate-limit.ts` — 滑動窗口限流 60 次/分 + 10 次失敗鎖 15 分鐘
- [x] `POST/GET/DELETE /api/ai/keys` — API Key 管理（僅 admin JWT）
- [x] `GET /api/ai/overview` — 專案總覽端點（並行查詢、統計、階段、最近卡片）
- [x] `POST /api/ai/batch` — 批次更新卡片（最多 50 筆、失敗隔離、活動日誌）
- [x] DB migration: `api_keys` + `api_key_audit_log` 表
- [x] 所有既有 API 路由加入 auth guard（支援 JWT + API Key 雙模式）
- [x] Build 驗證通過 ✅ (`6de5ddb`)

### LINE Login + LINE 推播通知（暫緩）
**狀態：暫不需要 ⏸️ — 目前用應用內通知中心即可**
**技術備忘：** `memory/decisions/auth-simplification.md`
**程式碼已完成，待日後需要時啟用：**

- 階段 0：LINE Developers Console 前置設定（未開始）
- 階段 2：LINE OAuth Login（程式碼已寫好）
- 階段 3：設定頁 LINE 手動綁定（程式碼已寫好）
- 階段 4：LINE 每日摘要推播 API（程式碼已寫好）
- ~~排程：Zeabur Cron Job~~ — 不需要（改用應用內通知）

---

## UI/UX 重設計 — Web Interface Guidelines 合規
**狀態：批次 1-6 完成 ✅（待視覺驗證）**
**計畫檔：** `~/.claude/plans/fuzzy-wiggling-tower.md`

### 批次 1：色彩系統統一 + 字體放大（最高優先）✅
- [x] 1-0. `globals.css` — 全域字體放大（@theme 覆蓋 text-xs/sm/base/lg）
- [x] 1-1. `globals.css` — 新增品牌色彩 CSS 變數（brand-bg/primary/green/accent 等）+ dark mode 對應值
- [x] 1-2a. `admin/notifications/page.tsx` — 移除 60 處 inline style + JS hover → Tailwind
- [x] 1-2b. `settings/page.tsx` — 刪除 COLORS 常數，改用 Tailwind token（43 處）
- [x] 1-2c. `notifications/page.tsx` — 刪除 COLORS 常數（31 處）
- [x] 1-2d. `admin/layout.tsx` — 移除 22 處 hardcoded 色彩 + JS hover → CSS
- [x] 1-2e. `admin/page.tsx` — 統計卡色彩（28 處）
- [x] 1-2f. `admin/projects/page.tsx` — 表格色彩 + JS hover（32 處）
- [x] 1-2g. `projects/page.tsx` — header/按鈕色彩（18 處）
- [x] 1-2h. `login/page.tsx` — 背景/按鈕色彩（6 處）
- [x] 1-2i. `calendar/page.tsx` + `calendar-views.tsx` — header 色彩（11 處）
- [x] 1-2j. `admin/users/page.tsx` + `admin/users/[id]/page.tsx` — 表格/詳情（15 處）
- [x] 1-2k. `admin/api-keys/page.tsx` — 表格/按鈕（7 處）
- [x] 1-2l. `reset-password/page.tsx` — 背景色彩（8 處）
- [x] 1-2m. `views.tsx` + `card-detail.tsx` + `gantt.tsx` + `page.tsx (board)` — 剩餘 inline style
- [x] 1-2n. `UserNav.tsx` — badge 色彩（4 處）
- [x] 1-3. `layout.tsx` — 加 colorScheme + themeColor meta（viewport export）
- [x] 1-4. `text-[10px]`/`text-[11px]` 手動升級為 `text-xs`（14 處，UserNav badge 保留）

### 批次 2：無障礙性修復 ✅
- [x] 2-1. `layout.tsx` — 加 skip link + 各頁面 `id="main-content"`（12 頁）
- [x] 2-2. Icon button 補 `aria-label`（card-detail / recurring-tasks / views / gantt）
- [x] 2-3. 表單 label + autocomplete（login / reset-password）
- [x] 2-4. `login/page.tsx` — error/success div 加 `role="alert"`

### 批次 3：表單改善 ✅
- [x] 3-1. `...` → `…`（placeholder + loading 文字全面替換）
- [x] 3-2. Submit 按鈕加 loading spinner（login / reset-password）
- [x] 3-3. 登入/註冊表單 input 加 `name` + `autoComplete` 屬性

### 批次 4：Focus State 修復 ✅
- [x] 4-1. `focus:` → `focus-visible:`（14 檔案 ring/border 視覺狀態）
- [x] 4-2. 保留 `focus:outline-none` / `focus:ring-0`（reset 用途）

### 批次 5：Typography 與微互動 ✅
- [x] 5-1. 數字區加 `tabular-nums`（notifications / ProgressView / admin stats）
- [x] 5-2. 標題加 `text-balance`（h1 頁面標題）
- [x] 5-3. `formatDate` 改用 `Intl.DateTimeFormat`（notifications/page.tsx）
- [x] 5-4. 卡片標題 `line-clamp-2`、專案描述 `line-clamp-3`

### 批次 6：動畫與效能 ✅
- [x] 6-1. `transition-all` → 具體屬性（transition-colors/shadow/transform/[width] 等）
- [x] 6-2. Modal/Drawer 加 `overscroll-contain`
- [x] 6-3. 視圖切換 URL 同步（useState → useSearchParams）
- [x] 6-4. `globals.css` — 加 prefers-reduced-motion + touch-action 全域規則

### 驗證
- [x] `pnpm run build` 無錯誤 ✅
- [x] Dark mode 切換 — 所有頁面無白色殘塊 ✅
- [x] 鍵盤 Tab 導航 — 所有互動元素有 focus ring ✅

---

## 待驗證項目
- [x] Discord OAuth 登入流程 ✅
- [x] Discord 登入 403 修復 ✅
- [x] 進度顯示修復 ✅
- [x] 帳密登入/註冊流程正常 ✅
- [x] 未登入可瀏覽、寫入操作回 401 ✅
- [x] Playwright E2E 無回歸 ✅
