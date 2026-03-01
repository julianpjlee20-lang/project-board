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

## 暫緩功能（未來 Feature）

### LINE Login
**狀態：暫緩 ⏸️**
**技術備忘：** `memory/decisions/auth-simplification.md`

- [ ] LINE Developers Console 設定（Channel ID/Secret/Callback URL）
- [ ] `src/auth.ts` 加回 LINE provider
- [ ] 登入頁加回 LINE 按鈕

### LINE 通知系統
**狀態：代碼已完成，待 LINE Login 啟用後驗證 ⏸️**

- [x] LINE Messaging API Flex Message 推播 (`src/lib/line-messaging.ts`)
- [x] 統一通知分發器 (`src/lib/notifications.ts`)
- [x] 通知偏好 CRUD (`src/app/api/notifications/preferences/route.ts`)
- [x] 佇列摘要發送 (`src/app/api/notifications/flush/route.ts`)
- [ ] LINE 通知端對端驗證

---

## 待驗證項目
- [x] Discord OAuth 登入流程 ✅
- [ ] 帳密登入/註冊流程正常
- [ ] 未登入可瀏覽、寫入操作回 401
- [ ] Playwright E2E 無回歸
