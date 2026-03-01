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

## 當前階段：LINE Login + LINE 通知 + Discord 修復
**狀態：代碼完成 ✅（待設定環境變數）**
**計畫檔：** `~/.claude/plans/fuzzy-plotting-coral.md`

### 前置作業（手動）
- [ ] 1. LINE Developers Console 建立 LINE Login Channel → 取得 Channel ID + Secret
- [ ] 2. LINE Developers Console 建立 Messaging API Channel → 取得 Channel Access Token
- [ ] 3. Login Channel 設定 Callback URL + bot_prompt=aggressive
- [ ] 4. 設定環境變數到 `.env`
- [ ] 5. （可選）Discord Developer Portal 設定 Client ID/Secret

### Phase 1：DB Schema 更新
- [x] 6. profiles 加 line_display_name, line_picture_url (`src/app/api/projects/route.ts`)
- [x] 7. 新增 notification_preferences 表 (`src/app/api/projects/route.ts`)
- [x] 8. 新增 notification_queue 表 (`src/app/api/projects/route.ts`)

### Phase 2：LINE Login + Auth 共用層
- [x] 9. getCurrentUser() helper (`src/lib/auth.ts` 新檔案)
- [x] 10. LINE OAuth 啟動 (`src/app/api/auth/line/route.ts` 新檔案)
- [x] 11. LINE OAuth 回調 (`src/app/api/auth/line/callback/route.ts` 新檔案)
- [x] 12. 取得當前使用者 API (`src/app/api/auth/me/route.ts` 新檔案)
- [x] 13. 登出 API (`src/app/api/auth/logout/route.ts` 新檔案)
- [x] 14. Discord redirect URI 改用環境變數 (`src/app/api/auth/discord/`)

### Phase 3：登入頁 UI
- [x] 15. LINE 為主按鈕 + Discord 備選 + 錯誤訊息 (`src/app/login/page.tsx`)

### Phase 4：LINE 通知後端
- [x] 16. LINE Messaging API Flex Message 推播 (`src/lib/line-messaging.ts` 新檔案)
- [x] 17. 統一通知分發器 (`src/lib/notifications.ts` 新檔案)
- [x] 18. 替換 sendDiscordNotification → sendNotification (`src/app/api/cards/[id]/route.ts`)
- [x] 19. notificationPreferencesSchema (`src/lib/validations.ts`)

### Phase 5：通知管理 API
- [x] 20. 通知偏好 CRUD (`src/app/api/notifications/preferences/route.ts` 新檔案)
- [x] 21. 佇列摘要發送 (`src/app/api/notifications/flush/route.ts` 新檔案)

---

## 下一階段：Auth.js v5 遷移（手寫 OAuth → Auth.js）
**狀態：規劃完成，待實作**
**計畫檔：** `~/.claude/plans/mossy-gliding-quokka.md`

### 目標
- 手寫 OAuth（~300 行）→ Auth.js v5 JWT 模式（~150 行）
- Session 驗證不再打 DB（JWT 內嵌 profileId）
- 加 middleware 保護寫入操作（未登入可唯讀瀏覽）
- 架構支援未來擴展 Google / Facebook provider
- 帳號連結：手動連結模式（設定頁面）

### Step 1：安裝 + 環境變數
- [ ] 1. `pnpm add next-auth@beta` + 設定 `AUTH_SECRET` 等環境變數

### Step 2：Auth.js 核心設定
- [ ] 2. 新增 `src/auth.ts` — providers（Discord 內建 + LINE 自訂）、JWT/session callbacks、signIn upsert 邏輯
- [ ] 3. 新增 `src/types/next-auth.d.ts` — TypeScript 型別擴展（profileId、provider）

### Step 3：Route Handler + Middleware
- [ ] 4. 新增 `src/app/api/auth/[...nextauth]/route.ts` — catch-all handler
- [ ] 5. 新增 `src/middleware.ts` — GET 放行、POST/PUT/PATCH/DELETE 需登入

### Step 4：替換 getCurrentUser()
- [ ] 6. 修改 `src/lib/auth.ts` — 改用 `auth()` 從 JWT 取得 profileId（不查 DB）
- [ ] 7. 新增 `getFullProfile()` helper — 通知系統需要時才查 DB 取 line_user_id

### Step 5：更新前端
- [ ] 8. 修改 `src/app/login/page.tsx` — 改用 `signIn("line")` / `signIn("discord")`

### Step 6：DB Schema + 清理
- [ ] 9. profiles 表加 `email`、`google_id`、`facebook_id` 欄位（為未來 provider 準備）
- [ ] 10. 刪除舊 auth 檔案（discord/、line/、logout/、me/ 共 5 檔）
- [ ] 11. 更新 `.env.example`、`CLAUDE.md`

### 驗證
- [ ] 12. LINE + Discord OAuth 流程正常
- [ ] 13. 未登入可瀏覽、寫入操作回 401
- [ ] 14. 通知系統正常運作
- [ ] 15. `pnpm run build` + Playwright E2E 無回歸
