# Phase 功能需求規格

## 功能概述
在專案與任務之間新增「階段 (Phase)」層級，用於營造公司工程階段分組（如基礎工程、結構工程、裝修工程）。

## 決策記錄
- **命名**：階段 / Phase
- **架構**：Card 同時屬於 Phase（分類）+ Column（狀態），兩者並存
- **Phase 進度**：自動計算（該階段中「完成」欄位的卡片數 / 總卡片數 × 100%）
- **Phase 依賴**：暫不實作，未來再加
- **子任務 UI**：Trello 風格 Checklist（進度條 + checkbox + 新增/刪除）
- **優先度**：高/中/低（紅/黃/綠標記）
- **卡片資訊**：優先度 + Phase 標籤 + 子任務預覽 + 標籤 + 進度條 + 截止日 + 指派人

## 資料架構

```
Project
  ├── Phase[]   (工程階段：基礎工程、結構工程、裝修工程...)
  └── Column[]  (狀態欄：待辦、進行中、完成)

Card
  ├── phase_id   → Phase (屬於哪個階段，可為 NULL)
  ├── column_id  → Column (目前狀態，拖拉改這個)
  ├── priority   → 'low' | 'medium' | 'high'
  └── subtasks   → Subtask[]
```

## DB Schema

```sql
CREATE TABLE IF NOT EXISTS phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4EA7FC',
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cards ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES phases ON DELETE SET NULL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
```

## 需要修改的檔案

### 後端
1. **`src/app/api/projects/route.ts`** — DB migration（phases 表 + cards 加欄位）
2. **`src/app/api/projects/[id]/phases/route.ts`** — Phase CRUD API（新檔案）
   - GET：列出 phases + 自動計算進度
   - POST：建立 phase
   - PUT：更新 phase
   - DELETE：刪除 phase
3. **`src/lib/validations.ts`** — updateCardSchema 加 priority, phase_id；新增 phase schemas
4. **`src/app/api/cards/[id]/route.ts`** — PUT 支援 priority, phase_id + activity log
5. **`src/app/api/projects/[id]/columns/route.ts`** — GET 補上 subtasks, tags, phase_id, priority

### 前端
6. **`src/app/projects/[id]/types.ts`** — Card 加 priority, phase_id；新增 Phase interface
7. **`src/app/projects/[id]/page.tsx`** — Phase 篩選 Tab + 管理 UI + CardItem 強化 + CardModal 強化
8. **`src/app/projects/[id]/views.tsx`** — ListView 加 Phase, Priority 欄位

## 現有 API 可直接使用（不需修改）
- Subtask API (`/api/cards/[id]/subtasks`) — 完整 CRUD 已就緒
- Tags API — 已就緒
- Comments API — 已就緒
- Activity Logs API — 已就緒

## 已知缺口（CardModal 目前缺少）
- 子任務管理介面（API 有但 UI 沒有）
- 標籤顯示
- 進度條顯示
- 以上都需要在此次開發中補齊
