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
