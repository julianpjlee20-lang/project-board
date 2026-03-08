# Project Board API 文件

> 完整的 REST API 參考手冊，適用於外部整合、AI Agent、自動化腳本。

## 基礎資訊

| 項目 | 值 |
|------|-----|
| Base URL | `https://<your-domain>` |
| API 前綴 | `/api/` |
| 回應格式 | JSON |
| 字元編碼 | UTF-8 |

---

## 認證

系統支援兩種認證方式。

### 1. Session Cookie（瀏覽器用戶）

Auth.js v5 JWT cookie，透過登入流程自動設定。支援帳號密碼、Discord OAuth、LINE OAuth。

### 2. API Key（外部整合用）

```
Authorization: Bearer pb_<64位十六進位字元>
```

**權限等級：**

| 等級 | 值 | 效果 |
|------|-----|------|
| 完整存取 | `full` | 所有 GET/POST/PUT/PATCH/DELETE 操作 |
| 唯讀 | `read_only` | 僅 GET；寫入操作回傳 `403` |

**關鍵事項：**
- API Key 僅在建立時顯示一次明文，資料庫只儲存 SHA-256 雜湊值
- `/api/ai/keys` 僅限管理員 JWT session（不接受 API Key）
- 認證優先順序：`Authorization` header → session cookie

---

## 錯誤回應格式

| 狀態碼 | 回應 | 說明 |
|--------|------|------|
| `401` | `{ "error": "未登入" }` | 未提供認證 |
| `403` | `{ "error": "權限不足" }` | 已認證但權限不足 |
| `403` | `{ "error": "此 API Key 為唯讀權限，無法執行寫入操作" }` | 唯讀 Key 嘗試寫入 |

**驗證錯誤（400）：**
```json
{ "error": "輸入驗證失敗", "details": [{ "path": "field_name", "message": "錯誤描述" }] }
```

**伺服器錯誤（500）：**
```json
{ "error": "Failed to ...", "detail": "錯誤詳情" }
```

---

## 快速上手

1. **健康檢查**：`GET /api/health`（不需認證）
2. **取得所有專案**：`GET /api/projects`（不需認證）
3. **取得看板資料**：`GET /api/projects/{id}/columns`（不需認證，含所有欄位與卡片）
4. **AI Agent 全貌**：`GET /api/ai/overview`（需認證，一次取得所有專案狀態）

```bash
# 範例：取得 API Key 後存取所有資源
Authorization: Bearer pb_YOUR_KEY
```

---

## 資料模型

```typescript
interface Project {
  id: string; name: string; description: string | null;
  status: "active" | "completed" | "archived";
  start_date: string | null; end_date: string | null;   // YYYY-MM-DD
  created_by: string | null; created_at: string; updated_at: string;
}

interface Column {
  id: string; project_id: string; name: string;
  color: string;      // #RRGGBB
  position: number;   // 0-based
  created_at: string;
}

interface Card {
  id: string; card_number: number | null; column_id: string;
  title: string; description: string | null;
  progress: number;                           // 0-100
  priority: "low" | "medium" | "high";
  phase_id: string | null;
  start_date: string | null; due_date: string | null;
  planned_completion_date: string | null; actual_completion_date: string | null;
  position: number; created_at: string; updated_at: string;
  // 透過 GET /api/cards/[id] 或 GET /api/projects/[id]/columns 包含：
  assignees: { id: string; name: string }[];
  subtasks: Subtask[];
  tags: { id: string; name: string; color: string }[];
}

interface Subtask {
  id: string; card_id: string; title: string;
  is_completed: boolean; position: number;
  due_date: string | null; assignee_id: string | null; assignee_name: string | null;
  created_at: string;
}

interface Phase {
  id: string; project_id: string; name: string; color: string;
  position: number; total_cards: number; completed_cards: number;
  progress: number;   // 0-100，伺服器端計算
  created_at: string;
}

interface Tag {
  id: string; project_id: string; name: string;
  color: string;      // #RRGGBB，預設 '#4EA7FC'
}
```

---

## 認證需求一覽表

| 端點 | 需認證 | 備註 |
|------|--------|------|
| `GET /api/health` | 否 | |
| `GET /api/projects` | 否 | |
| `GET /api/projects/[id]` | 否 | |
| `GET /api/projects/[id]/columns` | 否 | 含完整卡片資料 |
| `GET /api/projects/[id]/phases` | 否 | |
| `GET /api/projects/[id]/tags` | 否 | |
| `GET /api/columns` | 否 | |
| `GET /api/cards` | 是 | 任何已認證用戶 |
| `GET /api/cards/[id]` | 否 | |
| `GET /api/cards/[id]/subtasks` | 否 | |
| `GET /api/cards/[id]/tags` | 否 | |
| `GET /api/cards/[id]/activity` | 否 | |
| `GET /api/calendar` | 是 | |
| `GET /api/notifications/*` | 是 | |
| `GET /api/users/me` | 是 | |
| `GET /api/users/active` | 是 | |
| `GET /api/ai/overview` | 是 | |
| `GET /api/projects/[id]/templates` | 是 | |
| `GET /api/docs` | 否 | 回傳 API 文件（Markdown） |
| `GET /api/openapi.json` | 否 | OpenAPI 3.1 規格 |
| `POST /api/auth/register` | 否 | |
| `GET /api/auth/me` | 是 | |
| `POST /api/auth/logout` | 否 | |
| `POST /api/auth/forgot-password` | 否 | |
| `GET/POST /api/auth/reset-password` | 否 | |
| `POST /api/notifications/flush` | 否 | 內部排程用 |
| `POST /api/notifications/daily-digest` | 是 | CRON_SECRET 或 Admin |
| 所有 POST/PUT/PATCH/DELETE（非管理員） | 是 | 需寫入權限 |
| `POST /api/ai/batch` | 是 | 需寫入權限，最多 50 筆 |
| `/api/ai/keys` 系列 | 是 | 僅限管理員 JWT（不接受 API Key） |
| `/api/admin/*` 系列 | 是 | 僅限管理員 |

---

## API 端點

### Health（健康檢查）

#### GET /api/health
不需認證。回傳資料庫連線狀態與 profiles 表筆數。
→ `200`: `{ "database": { "ok": true, "time": "..." }, "profiles_table": { "ok": true, "count": 42 } }`
→ `503`: 資料庫異常時，`ok` 為 `false`

---

### Projects（專案）

#### GET /api/projects
取得所有專案，按建立時間降序。→ `200`: Project[]

#### POST /api/projects [認證+寫入]
自動建立三個預設欄位（待辦、進行中、已完成）。
Body: `{ name* (max 200), description? (max 5000), status?("active"|"completed"|"archived"), start_date?(YYYY-MM-DD), end_date? }`
→ `200`: `{ success: true, id, name, description, status, start_date, end_date }`

#### GET /api/projects/[id]
→ `200`: Project 物件 | `404`: `{ "error": "Project not found" }`

#### DELETE /api/projects/[id] [認證+寫入]
CASCADE 刪除所有相關資料（欄位、卡片、子任務、標籤）。→ `200`: `{ success: true }`

#### GET /api/projects/[id]/columns
**主要看板端點**。取得所有欄位，每欄包含完整卡片（含 assignees、subtasks、tags）。
```json
[{ "id": "uuid", "name": "待辦", "color": "#EF4444", "position": 0,
   "cards": [{ "id": "uuid", "card_number": 1, "title": "Task", "progress": 0,
               "priority": "medium", "assignees": [], "subtasks": [], "tags": [] }] }]
```

#### POST /api/projects/[id]/columns [認證+寫入]
Body: `{ name*, color?(#RRGGBB, 預設#4EA7FC), position? }`
→ `200`: Column 物件

---

### Columns（欄位 — 全域操作）

#### GET /api/columns
取得所有專案的所有欄位，按 position 排序。→ `200`: Column[]

#### POST /api/columns [認證+寫入]
Body: `{ project_id*, name* (max 100), color? }`

#### PUT /api/columns [認證+寫入]
Body: `{ id*, name?, color?, position? }`

#### DELETE /api/columns?id=uuid [認證+寫入]
連帶刪除欄位內所有卡片。→ `200`: `{ success: true }`

---

### Cards（卡片）

#### GET /api/cards [認證]
Query: `project_id*`, `column_id?`, `limit?`（預設 100，max 500）
→ `200`: `{ total: number, cards: Card[] }`

#### POST /api/cards [認證+寫入]
自動加到欄位末尾，分配專案內流水號。
Body: `{ column_id*, title* (max 200), phase_id?, assignee_id? }`
→ `200`: Card 物件（含 card_number）

#### GET /api/cards/[id]
含 assignees、subtasks、tags。→ `200`: Card 物件 | `404`

#### PUT /api/cards/[id] [認證+寫入]
記錄活動日誌並觸發通知。Body（全選填）：
`title (max 200)`, `description (max 5000, ""清空)`, `assignee_id (""或null取消)`,
`progress (0-100)`, `priority`, `phase_id`, `start_date`, `due_date`,
`planned_completion_date`, `actual_completion_date`

限制：同時設定 start_date 和 due_date 時，start_date 不能晚於 due_date。
→ `200`: `{ success: true, auto_transition?: { moved: true, newColumnId, newColumnName } }`

#### DELETE /api/cards/[id] [認證+寫入]
→ `200`: `{ success: true }`

#### POST /api/cards/move [認證+寫入]
移動卡片到不同欄位（或同欄不同位置），自動重新排序。
Body: `{ card_id*, source_column_id*, dest_column_id*, source_index*, dest_index* }`
→ `200`: `{ success: true }`

#### POST /api/cards/reorder [認證+寫入]
批次重排欄位內卡片，按提供順序分配 position 0, 1, 2...
Body: `{ column_id*, cards*: [{ id }] }`
→ `200`: `{ success: true }`

---

### Subtasks（子任務）

#### GET /api/cards/[id]/subtasks
按 position 排序。→ `200`: Subtask[]

#### POST /api/cards/[id]/subtasks [認證+寫入]
Body: `{ title* (max 200), due_date?(YYYY-MM-DD), assignee_id? }`
→ `200`: Subtask 物件

#### PUT /api/cards/[id]/subtasks [認證+寫入]
設 is_completed 可觸發自動狀態轉換（見下節）。
Body: `{ subtask_id*, title?, is_completed?, due_date?("" 或 null 清空), assignee_id?("" 或 null 清空) }`
→ `200`: `{ success: true, auto_transition?: { moved: true, newColumnId, newColumnName } }`

#### DELETE /api/cards/[id]/subtasks?subtask_id=uuid [認證+寫入]
→ `200`: `{ success: true }`

---

### Tags（標籤）

#### GET /api/projects/[id]/tags
→ `200`: Tag[]

#### POST /api/projects/[id]/tags [認證+寫入]
Body: `{ name*, color?(預設#4EA7FC) }`
→ `200`: Tag 物件

#### DELETE /api/projects/[id]/tags?tag_id=uuid [認證+寫入]
同時從所有卡片移除。→ `200`: `{ success: true }`

#### GET /api/cards/[id]/tags
→ `200`: Tag[]

#### POST /api/cards/[id]/tags [認證+寫入]
冪等操作，重複加不報錯。Body: `{ tag_id* }`
→ `200`: `{ success: true }`

#### DELETE /api/cards/[id]/tags?tag_id=uuid [認證+寫入]
→ `200`: `{ success: true }`

---

### Phases（階段）

#### GET /api/projects/[id]/phases
含自動計算的進度統計。卡片「已完成」條件：欄位名稱含 "done" 或 "完成"（不分大小寫）。
→ `200`: Phase[]

#### POST /api/projects/[id]/phases [認證+寫入]
Body: `{ name* (max 100), color? }`
→ `200`: Phase 物件

#### PUT /api/projects/[id]/phases [認證+寫入]
Body: `{ id*, name?, color?, position? }`
→ `200`: Phase 物件

#### DELETE /api/projects/[id]/phases?id=uuid[&targetPhaseId=uuid] [認證+寫入]
`targetPhaseId` 選填，指定後將被刪階段的卡片遷移到目標階段。→ `200`: `{ success: true }`

---

### Activity（活動日誌）

#### GET /api/cards/[id]/activity
最近 20 筆，最新在前。
→ `200`: `[{ id, action, target, old_value, new_value, user_name, created_at }]`

---

### Calendar（行事曆）

#### GET /api/calendar [認證]
跨專案行事曆，回傳所有具有日期欄位的卡片。
```json
{
  "cards": [{ "id": "uuid", "card_number": 5, "title": "Task", "progress": 70,
              "priority": "high", "due_date": "2026-04-01", "start_date": "2026-03-01",
              "planned_completion_date": "2026-03-28", "actual_completion_date": null,
              "column_id": "uuid", "column_name": "進行中", "column_color": "#3B82F6",
              "project_id": "uuid", "project_name": "My Project",
              "assignees": [{ "id": "uuid", "name": "Alice" }],
              "tags": [{ "id": "uuid", "name": "Feature", "color": "#3B82F6" }] }],
  "projects": [{ "id": "uuid", "name": "My Project" }]
}
```
篩選邏輯：至少有一個日期欄位（due_date、start_date、planned_completion_date、actual_completion_date）。

---

### Notifications（通知）

所有通知端點需認證（flush 例外）。

#### GET /api/notifications/center [認證]
完整通知中心資料。
```json
{ "due_soon": [...], "overdue": [...], "recent_changes": [...],
  "project_summary": [...], "dismissed": [...],
  "counts": { "due_soon": 1, "overdue": 1, "recent_changes": 15 } }
```
- 逾期：`due_date < 現在` 且未完成且不在最後欄位
- 即將到期：`due_date` 在未來 7 天內

#### GET /api/notifications/count [認證]
輕量徽章計數。→ `200`: `{ count: number }`

#### POST /api/notifications/dismiss [認證]
冪等。Body: `{ card_id*, dismiss_type*("overdue"|"due_soon") }`
→ `200`: `{ success: true }`

#### DELETE /api/notifications/dismiss [認證]
恢復已忽略通知。Body: `{ card_id*, dismiss_type* }`
→ `200`: `{ success: true }`

#### GET /api/notifications/preferences [認證]
→ `200`: `{ notify_assigned, notify_title_changed, notify_due_soon, notify_moved, quiet_hours_start, quiet_hours_end }`

#### PUT /api/notifications/preferences [認證]
UPSERT。Body（全選填）: `{ notify_assigned?, notify_title_changed?, notify_due_soon?, notify_moved?, quiet_hours_start?, quiet_hours_end? }`
→ `200`: 更新後的完整偏好設定物件

#### POST /api/notifications/flush（不需認證，內部排程）
合併推播 notification_queue 中未發送通知，按用戶分組，最多顯示 5 則。
→ `200`: `{ message, sent, users }`

#### POST /api/notifications/daily-digest [CRON_SECRET 或 Admin]
發送每日摘要。可透過 `?secret=CRON_SECRET` query param 或管理員 session 認證。
Boss 用戶看全部卡片，一般用戶只看指派給自己的。
→ `200`: `{ success, sent_count, skipped_count, total_users, digest_summary: { overdue_count, upcoming_count, yesterday_changes, project_count } }`

---

### Users（用戶）

#### GET /api/users/me [認證]
取得當前用戶完整個人資料。→ `200`: Profile 物件

#### PUT /api/users/me [認證]
Body: `{ name?(1-100字元), avatar_url?(有效URL, ""清空) }`
→ `200`: 更新後的 Profile

#### PUT /api/users/me/password [認證]
僅限帳密登入的用戶（OAuth 用戶回傳 403）。
Body: `{ current_password*, new_password*(6-100字元), confirm_password* }`
→ `200`: `{ success: true }`

#### GET /api/users/active [認證]
用於指派選擇器。→ `200`: `{ users: [{ id, name, avatar_url }] }`

#### DELETE /api/users/me/line [認證]
解除 LINE 綁定。→ `200`: `{ success: true }`

---

### Auth（認證流程）

#### POST /api/auth/register
建立新用戶（inactive 狀態，需管理員啟用）。
Body: `{ email*, password*(6+字元), name? }`
→ `200`: `{ success: true, message }`

#### GET /api/auth/me [認證]
→ `200`: session user 物件

#### POST /api/auth/logout
清除 session。→ `200`: `{ success: true }`

#### POST /api/auth/forgot-password
Body: `{ email }` → 永遠回傳 200 防止 email 枚舉。同一 email 5 分鐘最多 3 次，token 有效 60 分鐘。

#### GET /api/auth/reset-password?token=xxx
→ `200`: `{ valid: true, email: "a***@example.com" }` | `400`: `{ valid: false, error }`

#### POST /api/auth/reset-password
Body: `{ token*, new_password*, confirm_password* }`
→ `200`: `{ message: "密碼已重設，請重新登入" }`

---

### AI / 全域總覽

#### GET /api/ai/overview [認證]
**推薦 AI Agent 使用**，一次取得所有專案的完整狀態。
```json
{ "total_projects": 3,
  "projects": [{ "id": "uuid", "name": "My Project", "status": "active",
                 "columns": [{ "id": "uuid", "name": "待辦", "color": "#EF4444", "position": 0, "card_count": 5 }],
                 "stats": { "total_cards": 20, "completed_cards": 8, "overdue_cards": 2, "avg_progress": 45 },
                 "phases": ["..."],
                 "recent_cards": [{ "id": "uuid", "card_number": 5, "title": "Latest task",
                                    "progress": 70, "priority": "high", "column_name": "進行中",
                                    "assignees": [{ "id": "uuid", "name": "Alice" }] }] }] }
```

#### POST /api/ai/batch [認證+寫入]
**推薦 AI Agent 批次更新多張卡片**，最多 50 筆，使用 transaction 保證一致性。
```json
{ "project_id": "uuid",
  "updates": [{ "card_id": "uuid", "title": "New title", "description": "...",
                "progress": 80, "priority": "high", "due_date": "2026-04-01",
                "start_date": "2026-03-01", "phase_id": "uuid", "assignee_id": "uuid",
                "move_to_column": "已完成" }] }
```
`move_to_column` 為欄位名稱（需提供 `project_id`）。所有欄位選填，除 `card_id` 必填。
→ `200`: `{ success, summary: "2/2 筆更新成功", results: [{ card_id, status, card_number }] }`

---

### Templates（模板）

#### GET /api/projects/[id]/templates [認證]
→ `200`: `{ templates: [{ id, project_id, name, title_pattern, description, priority, target_column_id, rolling_due_date, created_at, updated_at, subtasks: [{ id, title, position, day_of_month, assignee_id, assignee_name }] }] }`

#### POST /api/projects/[id]/templates [認證+寫入]
兩種模式：

**模式 A — 從現有卡片建立：** Body: `{ source_card_id* }`

**模式 B — 空白建立：**
Body: `{ name*, title_pattern?, description?, priority?, target_column_id?, rolling_due_date?, subtasks?: [{ title*, position*, day_of_month?, assignee_id? }] }`

`title_pattern` 支援 `{{YYYY}}` 和 `{{MM}}` 替換。→ `201`: 完整模板物件

#### PUT /api/templates/[id] [認證+寫入]
子任務會被完全替換。Body（全選填）: `{ name?, title_pattern?, description?, priority?, target_column_id?, rolling_due_date?, subtasks? }`
→ `200`: 更新後的完整模板物件

#### DELETE /api/templates/[id] [認證+寫入]
子任務透過 CASCADE 自動刪除。→ `200`: `{ success: true }`

#### POST /api/templates/[id]/generate [認證+寫入]
Body: `{ start_month*(YYYY-MM), count* }`

- `day_of_month` 超過月份天數時自動調整到月底
- `rolling_due_date = true`：母卡 due_date 取子任務中**最小**截止日
- `rolling_due_date = false`：母卡 due_date 取子任務中**最大**截止日

→ `200`: `{ cards: [{ id, column_id, title, description, priority, position, card_number, due_date }], count }`

---

### API Key 管理（僅限管理員 JWT）

所有端點僅限管理員 JWT session，不接受 API Key 認證。

#### GET /api/ai/keys
列出所有 Key（僅 metadata，不含明文）。→ `200`: `{ keys: [...] }`

#### POST /api/ai/keys
Body: `{ name* (max 100), permissions?("full"|"read_only", 預設"full"), expires_at? }`
→ `200`: `{ success, key: {...}, api_key: "pb_...", warning: "請立即複製..." }`

#### PATCH /api/ai/keys
重新生成 API Key 明文。Body: `{ key_id* }`
→ `200`: `{ success, api_key: "pb_...", warning: "請立即複製..." }`

#### DELETE /api/ai/keys
Body: `{ key_id*, action?("revoke"|"delete") }` → 預設 revoke（停用但保留記錄）

---

### Admin（僅限管理員）

#### GET /api/admin/stats
→ `200`: `{ total_users, active_users, disabled_users, total_projects, total_cards, users_this_month, credentials_users, discord_users }`

#### GET /api/admin/users
Query: `search?`, `role?`, `is_active?`, `page?(預設1)`, `limit?(預設20, max 100)`, `sort?`, `order?`
→ `200`: `{ users: [...], total, page, limit }`

#### GET /api/admin/users/[id]
→ `200`: 完整用戶資料

#### PATCH /api/admin/users/[id]
限制：不能停用自己、不能降級自己、不能移除最後一個管理員。
Body: `{ name?, role?, is_active? }`
→ `200`: 更新後的用戶

#### DELETE /api/admin/users/[id]
Body: `{ transfer_to?(uuid) }` — 選填，將被刪用戶資料轉移給目標用戶。
→ `200`: `{ success: true }`

#### POST /api/admin/users/[id]/reset-password
強制重設密碼（設 force_password_change = true）。→ `200`: `{ success: true }`

#### POST /api/admin/users/[id]/generate-reset-link
產生密碼重設連結（不寄 email），有效期 60 分鐘。→ `200`: `{ reset_link }`

#### GET /api/admin/projects
所有專案含統計（卡片數、成員數、建立者名稱）。→ `200`: `{ projects: [...] }`

#### GET /api/admin/notifications/settings
→ `200`: `{ settings: { boss_user_ids, daily_digest_enabled, digest_include_upcoming, digest_include_overdue, digest_include_yesterday_changes, digest_include_project_stats, digest_send_hour }, boss_users: [...] }`

#### PUT /api/admin/notifications/settings
Body（全選填）: `{ boss_user_ids?, daily_digest_enabled?, digest_include_upcoming?, digest_include_overdue?, digest_include_yesterday_changes?, digest_include_project_stats?, digest_send_hour? }`
→ `200`: `{ settings: { ... } }`

---

### Docs

#### GET /api/docs
回傳此 API 文件 Markdown 原始碼，不需認證。
Headers: `Content-Type: text/markdown; charset=utf-8`, `Cache-Control: public, max-age=3600`

#### GET /api/openapi.json
回傳 OpenAPI 3.1.0 JSON 規格，適用於 AI Agent 自動發現 API，不需認證。
Headers: `Content-Type: application/json`, `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=3600, s-maxage=86400`

---

## 自動狀態轉換

更新卡片或子任務時，系統可能自動移動卡片欄位，並在回應中附上 `auto_transition`。

**三條觸發規則：**

1. **設定日期觸發前移**：PUT /api/cards/[id] 設定 `due_date` 或 `start_date` 時，若卡片在**第一欄**，自動移到**第二欄**（不會移到最後欄）。
2. **全部子任務完成觸發後移**：PUT /api/cards/[id]/subtasks 將最後一個未完成子任務設為完成時，卡片自動移到**最後欄**（已完成欄）。
3. **取消子任務完成觸發退回**：PUT /api/cards/[id]/subtasks 取消完成且卡片**在最後欄**時，自動移回**第二欄**。

**附加行為：**
- 移到最後欄 → 自動填入 `actual_completion_date`（今日日期）
- 移出最後欄 → 自動清除 `actual_completion_date`

---

## 常見使用情境

**1. AI Agent 快速取得全貌**
```
GET /api/ai/overview  →  一次取得所有專案的狀態、統計、最近卡片
```

**2. 建立卡片完整流程**
```
GET  /api/projects/{id}/columns          →  找到目標欄位 UUID
POST /api/cards                          →  建立卡片（column_id, title, assignee_id）
PUT  /api/cards/{card_id}                →  設定優先級、截止日、描述
POST /api/cards/{card_id}/tags           →  加上標籤（tag_id）
```

**3. 批次更新多張卡片**
```
POST /api/ai/batch  →  一次更新最多 50 張卡片（支援移動欄位、更新欄位、設定優先級）
```

---

## 架構注意事項（Pitfalls）

### 雙層認證架構

本專案有兩層認證，開發或整合時必須理解：

```
請求進來
  ↓
第一層：Edge Middleware（src/proxy.ts）
  · 在 Edge Runtime 執行，先於 route handler
  · 用 Auth.js session（JWT cookie）檢查
  · 根據路徑決定放行、擋下或重導

  ↓ 通過後

第二層：Route Handler（requireAuth()）
  · 在 Node.js Runtime 執行
  · 支援 API Key（Bearer pb_）+ JWT session
  · 實際的業務邏輯認證
```

### Pitfall #1：Middleware 攔截 API Key 請求

**問題：** `src/proxy.ts` 的 `protectedPrefixes` 列出需認證路徑（如 `/api/cards`、`/api/columns`）。Middleware 在 Edge Runtime 用 Auth.js session 檢查，**不認 API Key**。帶 `Authorization: Bearer pb_xxx` 但無 session cookie 的請求會被直接 401，到不了 route handler。

**受影響路徑：** `/api/cards`、`/api/columns`、`/api/users`、`/api/projects`、`/api/notifications`

**解決方式（已實作）：** Middleware 最前面加規則，帶 `Bearer pb_` 的 API 請求直接放行：

```typescript
// src/proxy.ts
if (isApiRoute(pathname) && req.headers.get('authorization')?.startsWith('Bearer pb_')) {
  return NextResponse.next()
}
```

### Pitfall #2：新增受保護路由 checklist

新增需認證的 API route 時：
1. **不需要**手動加到 `protectedPrefixes` — API Key 在 middleware 層已放行，route handler 的 `requireAuth()` 處理認證
2. 路徑不在 `protectedPrefixes` → 未認證請求通過 middleware，由 `requireAuth()` 回 401
3. 路徑在 `protectedPrefixes` → 未認證請求被 middleware 攔截（API 回 401、頁面重導 /login）
4. **兩者結果相同**（都是 401），差別只在哪一層擋下

### Pitfall #3：除錯 API Key 認證失敗

| 檢查項目 | 如何確認 |
|----------|----------|
| Header 格式 | 必須是 `Authorization: Bearer pb_xxx`，不是 `x-api-key` |
| Middleware 是否攔截 | route handler 是否收到請求（加 console.log 在 handler 開頭） |
| API Key 是否有效 | `SELECT is_active, expires_at FROM api_keys WHERE key_prefix LIKE 'pb_xxx%'` |
| 帳號是否啟用 | `SELECT is_active FROM profiles WHERE id = <user_id>` |
| 權限是否足夠 | `read_only` key 不能 POST/PUT/DELETE（回 403 不是 401） |

### Pitfall #4：Edge Runtime 限制

`src/proxy.ts` 在 Edge Runtime 執行，有以下限制：
- **不能使用 `pg` 模組** — 無法直接查資料庫
- **不能做 API Key hash 比對** — API Key 驗證只能交給 route handler
- **只能用 JWT token 中的資訊** — 如 `session.user.role`
