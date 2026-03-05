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

系統支援兩種認證方式，每個需要認證的請求必須提供其中之一。

### 1. Session Cookie（瀏覽器用戶）

Auth.js v5 JWT cookie，透過登入流程自動設定。

**支援的登入方式：**

| 方式 | 說明 |
|------|------|
| 帳號密碼 | Email + Password（bcrypt 12 rounds） |
| Discord OAuth | OAuth 2.0 |
| LINE OAuth | OAuth 2.0（需設定 `AUTH_LINE_ID` 環境變數） |

### 2. API Key（外部整合用）

適合 AI Agent、CI/CD、腳本等非瀏覽器場景。

**格式：**
```
Authorization: Bearer pb_<64位十六進位字元>
```

**範例：**
```bash
curl -H "Authorization: Bearer pb_a1b2c3d4e5f6..." https://your-domain/api/projects
```

**權限等級：**

| 等級 | 值 | 效果 |
|------|-----|------|
| 完整存取 | `full` | 所有 GET/POST/PUT/PATCH/DELETE 操作 |
| 唯讀 | `read_only` | 僅 GET 操作；寫入操作回傳 `403` |

**重要事項：**
- API Key 僅在建立時顯示一次明文，之後無法再取得
- 資料庫只儲存 SHA-256 雜湊值
- API Key 無法管理其他 API Key（`/api/ai/keys` 僅限管理員 JWT session）
- 認證優先順序：先檢查 `Authorization` header → 再檢查 session cookie

**如何取得 API Key：**
1. 以管理員身份登入系統
2. 進入管理後台
3. 建立新的 API Key（選擇 `full` 或 `read_only` 權限）
4. 立即複製並安全保存回傳的金鑰

---

## 錯誤回應格式

### 認證錯誤

| 狀態碼 | 回應 | 說明 |
|--------|------|------|
| `401` | `{ "error": "未登入" }` | 未提供認證 |
| `403` | `{ "error": "權限不足" }` | 已認證但權限不足 |
| `403` | `{ "error": "此 API Key 為唯讀權限，無法執行寫入操作" }` | 唯讀 Key 嘗試寫入 |

### 驗證錯誤（400）

```json
{
  "error": "輸入驗證失敗",
  "details": [
    { "path": "field_name", "message": "錯誤描述" }
  ]
}
```

### 伺服器錯誤（500）

```json
{
  "error": "Failed to ...",
  "detail": "錯誤詳情"
}
```

---

## 快速上手

### 步驟 1：檢查系統健康狀態

```bash
curl https://your-domain/api/health
```

### 步驟 2：取得所有專案

```bash
curl -H "Authorization: Bearer pb_YOUR_KEY" \
  https://your-domain/api/projects
```

### 步驟 3：取得專案看板（含所有欄位與卡片）

```bash
curl -H "Authorization: Bearer pb_YOUR_KEY" \
  https://your-domain/api/projects/{project_id}/columns
```

### 步驟 4：取得全域總覽（推薦 AI Agent 使用）

```bash
curl -H "Authorization: Bearer pb_YOUR_KEY" \
  https://your-domain/api/ai/overview
```

---

## 資料模型

### Project（專案）

```typescript
{
  id: string              // UUID
  name: string
  description: string | null
  status: "active" | "completed" | "archived"
  start_date: string | null    // YYYY-MM-DD
  end_date: string | null      // YYYY-MM-DD
  created_by: string | null    // UUID → profiles.id
  created_at: string           // ISO 8601
  updated_at: string
}
```

### Column（欄位）

```typescript
{
  id: string
  project_id: string
  name: string
  color: string         // #RRGGBB
  position: number      // 0-based 排序
  created_at: string
}
```

### Card（卡片）

```typescript
{
  id: string
  card_number: number | null    // 專案內流水號
  column_id: string
  title: string
  description: string | null
  progress: number              // 0-100
  priority: "low" | "medium" | "high"
  phase_id: string | null
  start_date: string | null
  due_date: string | null
  planned_completion_date: string | null
  actual_completion_date: string | null
  position: number
  created_at: string
  updated_at: string
  // 透過 GET /api/cards/[id] 或 GET /api/projects/[id]/columns 取得時包含：
  assignees: { id: string; name: string }[]
  subtasks: Subtask[]
  tags: { id: string; name: string; color: string }[]
}
```

### Subtask（子任務）

```typescript
{
  id: string
  card_id: string
  title: string
  is_completed: boolean
  position: number
  due_date: string | null       // YYYY-MM-DD
  assignee_id: string | null
  assignee_name: string | null
  created_at: string
}
```

### Phase（階段）

```typescript
{
  id: string
  project_id: string
  name: string
  color: string        // #RRGGBB
  position: number
  total_cards: number
  completed_cards: number
  progress: number     // 0-100，伺服器端計算
  created_at: string
}
```

### Tag（標籤）

```typescript
{
  id: string
  project_id: string
  name: string
  color: string        // #RRGGBB，預設 '#4EA7FC'
}
```

---

## API 端點

### 認證需求一覽表

| 端點 | 需認證 | 備註 |
|------|--------|------|
| `GET /api/health` | 否 | |
| `GET /api/projects` | 否 | |
| `GET /api/projects/[id]` | 否 | |
| `GET /api/projects/[id]/columns` | 否 | 含完整卡片資料 |
| `GET /api/projects/[id]/phases` | 否 | |
| `GET /api/projects/[id]/tags` | 否 | |
| `GET /api/columns` | 否 | |
| `GET /api/cards/[id]` | 否 | |
| `GET /api/cards/[id]/subtasks` | 否 | |
| `GET /api/cards/[id]/tags` | 否 | |
| `GET /api/cards/[id]/activity` | 否 | |
| 所有其他 GET 端點 | 是 | 任何已認證用戶 |
| 所有 POST/PUT/PATCH/DELETE（非管理員） | 是 | 需寫入權限 |
| `/api/ai/keys` 系列 | 是 | 僅限管理員 JWT（不接受 API Key） |
| `/api/admin/*` 系列 | 是 | 僅限管理員 |

---

### Health（健康檢查）

#### `GET /api/health`

檢查系統與資料庫健康狀態。不需要認證。

**回應 `200`：**
```json
{
  "database": { "ok": true, "time": "2026-03-05T00:00:00.000Z" },
  "profiles_table": { "ok": true, "count": 42 }
}
```

**回應 `503`（系統異常）：**
```json
{
  "database": { "ok": false, "error": "連線錯誤訊息" },
  "profiles_table": { "ok": true, "count": 0 }
}
```

---

### Projects（專案）

#### `GET /api/projects`

取得所有專案，按建立時間降序排列。

```bash
curl https://your-domain/api/projects
```

**回應 `200`：** Project 物件陣列
```json
[
  {
    "id": "uuid",
    "name": "My Project",
    "description": null,
    "status": "active",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
]
```

---

#### `POST /api/projects`

建立新專案。自動建立三個預設欄位：「待辦」、「進行中」、「已完成」。

**需認證 + 寫入權限**

**Request Body：**
```json
{
  "name": "My Project",          // 必填，最多 200 字元
  "description": "Details...",   // 選填，最多 5000 字元
  "status": "active",            // 選填："active"|"completed"|"archived"，預設 "active"
  "start_date": "2026-01-01",    // 選填，YYYY-MM-DD
  "end_date": "2026-12-31"       // 選填，YYYY-MM-DD（必須 >= start_date）
}
```

**回應 `200`：**
```json
{
  "success": true,
  "id": "uuid",
  "name": "My Project",
  "description": null,
  "status": "active",
  "start_date": null,
  "end_date": null
}
```

---

#### `GET /api/projects/[id]`

取得單一專案。

**回應 `200`：** Project 物件

**回應 `404`：** `{ "error": "Project not found" }`

---

#### `DELETE /api/projects/[id]`

刪除專案及所有相關資料（欄位、卡片、子任務、標籤，透過 CASCADE）。

**需認證 + 寫入權限**

**回應 `200`：** `{ "success": true }`

---

#### `GET /api/projects/[id]/columns`

取得專案的所有欄位，每個欄位包含完整的卡片列表（含 assignees、subtasks、tags）。

**這是取得看板資料的主要端點。**

```bash
curl https://your-domain/api/projects/{id}/columns
```

**回應 `200`：**
```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "name": "待辦",
    "color": "#EF4444",
    "position": 0,
    "cards": [
      {
        "id": "uuid",
        "card_number": 1,
        "title": "Task 1",
        "progress": 0,
        "priority": "medium",
        "due_date": null,
        "assignees": [{ "id": "uuid", "name": "Alice" }],
        "subtasks": [
          { "id": "uuid", "title": "Sub 1", "is_completed": false }
        ],
        "tags": [{ "id": "uuid", "name": "Bug", "color": "#EF4444" }]
      }
    ]
  }
]
```

---

#### `POST /api/projects/[id]/columns`

在專案中建立欄位。

**需認證 + 寫入權限**

**Request Body：**
```json
{
  "name": "Review",       // 必填，非空
  "color": "#A855F7",     // 選填，#RRGGBB，預設 '#4EA7FC'
  "position": 3           // 選填，自動指派若省略
}
```

**回應 `200`：** 建立的 Column 物件

---

### Columns（欄位 — 全域操作）

#### `GET /api/columns`

取得所有專案的所有欄位，按 position 排序。

---

#### `POST /api/columns`

建立欄位。**需認證 + 寫入權限**

**Request Body：**
```json
{
  "project_id": "uuid",   // 必填
  "name": "Review",       // 必填，最多 100 字元
  "color": "#A855F7"      // 選填，預設 '#4EA7FC'
}
```

---

#### `PUT /api/columns`

更新欄位名稱、顏色或位置。**需認證 + 寫入權限**

**Request Body：**
```json
{
  "id": "uuid",           // 必填
  "name": "New Name",     // 選填
  "color": "#10B981",     // 選填
  "position": 2           // 選填
}
```

---

#### `DELETE /api/columns?id=<uuid>`

刪除欄位（連帶刪除所有卡片）。**需認證 + 寫入權限**

---

### Cards（卡片）

#### `POST /api/cards`

建立卡片，自動加到欄位末尾，分配專案內流水號。

**需認證 + 寫入權限**

**Request Body：**
```json
{
  "column_id": "uuid",   // 必填
  "title": "Task title", // 必填，最多 200 字元
  "phase_id": "uuid"     // 選填，所屬階段 UUID，不帶時為 null
}
```

---

#### `GET /api/cards/[id]`

取得單一卡片，含 assignees、subtasks、tags。

```bash
curl https://your-domain/api/cards/{id}
```

**回應 `404`：** `{ "error": "Card not found" }`

---

#### `PUT /api/cards/[id]`

更新卡片欄位（僅提供要更新的欄位）。會記錄活動日誌並觸發通知。

**需認證 + 寫入權限**

**Request Body（全部選填）：**
```json
{
  "title": "Updated title",                    // 最多 200 字元
  "description": "Details...",                 // 最多 5000 字元，"" 清空
  "assignee_id": "uuid",                       // UUID，"" 或 null 取消指派
  "progress": 50,                              // 0-100
  "priority": "high",                          // "low"|"medium"|"high"
  "phase_id": "uuid",                          // UUID 或 null
  "start_date": "2026-01-01",                  // YYYY-MM-DD 或 "" 清空
  "due_date": "2026-06-30",                    // YYYY-MM-DD 或 "" 清空
  "planned_completion_date": "2026-06-01",
  "actual_completion_date": "2026-06-15"
}
```

**限制：** 同時設定 `start_date` 和 `due_date` 時，`start_date` 不能晚於 `due_date`。

**回應 `200`：** `{ "success": true }`

---

#### `DELETE /api/cards/[id]`

刪除卡片及所有相關資料。**需認證 + 寫入權限**

**回應 `200`：** `{ "success": true }`

---

#### `POST /api/cards/move`

將卡片移動到不同欄位（或同欄位不同位置），自動重新排序。

**需認證 + 寫入權限**

**Request Body：**
```json
{
  "card_id": "uuid",
  "source_column_id": "uuid",
  "dest_column_id": "uuid",
  "source_index": 0,
  "dest_index": 2
}
```

**回應 `200`：** `{ "success": true }`

---

#### `POST /api/cards/reorder`

批次重新排序欄位內的卡片。卡片按提供的順序分配 position 0, 1, 2...

**需認證 + 寫入權限**

**Request Body：**
```json
{
  "column_id": "uuid",
  "cards": [
    { "id": "uuid-card-1" },
    { "id": "uuid-card-2" }
  ]
}
```

---

### Subtasks（子任務）

#### `GET /api/cards/[id]/subtasks`

取得卡片的所有子任務，按 position 排序。

---

#### `POST /api/cards/[id]/subtasks`

建立子任務。**需認證 + 寫入權限**

**Request Body：**
```json
{
  "title": "Subtask title",   // 必填，最多 200 字元
  "due_date": "2026-06-30",   // 選填，YYYY-MM-DD
  "assignee_id": "uuid"       // 選填
}
```

---

#### `PUT /api/cards/[id]/subtasks`

更新子任務。**需認證 + 寫入權限**

**Request Body：**
```json
{
  "subtask_id": "uuid",         // 必填
  "title": "New title",         // 選填
  "is_completed": true,         // 選填
  "due_date": "2026-07-01",     // 選填，"" 或 null 清空
  "assignee_id": "uuid"         // 選填，"" 或 null 清空
}
```

---

#### `DELETE /api/cards/[id]/subtasks?subtask_id=<uuid>`

刪除子任務。**需認證 + 寫入權限**

---

### Tags（標籤）

#### `GET /api/projects/[id]/tags`

取得專案的所有標籤。

---

#### `POST /api/projects/[id]/tags`

建立標籤。**需認證 + 寫入權限**

**Request Body：**
```json
{
  "name": "Feature",    // 必填
  "color": "#3B82F6"    // 選填，預設 '#4EA7FC'
}
```

---

#### `DELETE /api/projects/[id]/tags?tag_id=<uuid>`

刪除標籤（同時從所有卡片移除）。**需認證 + 寫入權限**

---

#### `GET /api/cards/[id]/tags`

取得卡片上的標籤。

---

#### `POST /api/cards/[id]/tags`

為卡片加上標籤（冪等操作，重複加不會報錯）。**需認證 + 寫入權限**

**Request Body：** `{ "tag_id": "uuid" }`

---

#### `DELETE /api/cards/[id]/tags?tag_id=<uuid>`

從卡片移除標籤。**需認證 + 寫入權限**

---

### Phases（階段）

#### `GET /api/projects/[id]/phases`

取得專案的所有階段（含自動計算的進度統計）。

卡片被視為「已完成」的條件：所在欄位名稱包含 "done" 或 "完成"（不分大小寫）。

---

#### `POST /api/projects/[id]/phases`

建立階段。**需認證 + 寫入權限**

**Request Body：**
```json
{
  "name": "Phase 2",     // 必填，最多 100 字元
  "color": "#F59E0B"     // 選填
}
```

---

#### `PUT /api/projects/[id]/phases`

更新階段。**需認證 + 寫入權限**

**Request Body：**
```json
{
  "id": "uuid",           // 必填
  "name": "New Name",     // 選填
  "color": "#10B981",     // 選填
  "position": 1           // 選填
}
```

---

#### `DELETE /api/projects/[id]/phases?id=<phase_uuid>[&targetPhaseId=<uuid>]`

刪除階段。可選擇將其卡片遷移到另一個階段。**需認證 + 寫入權限**

| 參數 | 必填 | 說明 |
|------|------|------|
| `id` | 是 | 要刪除的階段 UUID |
| `targetPhaseId` | 否 | 遷移目標階段 UUID |

---

### Activity Log（活動日誌）

#### `GET /api/cards/[id]/activity`

取得卡片的活動日誌（最近 20 筆，最新在前）。

**回應 `200`：**
```json
[
  {
    "id": "uuid",
    "action": "修改",
    "target": "標題",
    "old_value": "舊標題",
    "new_value": "新標題",
    "user_name": "Alice",
    "created_at": "2026-03-05T10:00:00Z"
  }
]
```

---

### Notifications（通知）

所有通知端點都需要認證。

#### `GET /api/notifications/center`

取得完整通知中心資料：即將到期的卡片、逾期卡片、最近變更、專案摘要、已忽略的通知。

**回應 `200`：**
```json
{
  "due_soon": [...],
  "overdue": [...],
  "recent_changes": [...],
  "project_summary": [...],
  "dismissed": [...],
  "counts": {
    "due_soon": 1,
    "overdue": 1,
    "recent_changes": 15
  }
}
```

- **逾期定義：** `due_date < 現在` 且 `actual_completion_date IS NULL` 且卡片不在最後一個欄位
- **即將到期定義：** `due_date` 在未來 7 天內

---

#### `GET /api/notifications/count`

輕量級徽章計數 — 回傳未忽略的逾期 + 即將到期卡片總數。

**回應 `200`：** `{ "count": 5 }`

---

#### `POST /api/notifications/dismiss`

忽略通知（冪等）。

**Request Body：**
```json
{
  "card_id": "uuid",
  "dismiss_type": "overdue"    // "overdue" | "due_soon"
}
```

---

#### `DELETE /api/notifications/dismiss`

恢復已忽略的通知。

**Request Body：**
```json
{
  "card_id": "uuid",
  "dismiss_type": "due_soon"
}
```

---

### Users（用戶）

#### `GET /api/users/me`

取得當前用戶完整個人資料。**需認證**

---

#### `PUT /api/users/me`

更新當前用戶的個人資料。**需認證**

**Request Body（選填）：**
```json
{
  "name": "New Name",                          // 1-100 字元
  "avatar_url": "https://example.com/pic.jpg"  // 有效 URL，"" 清空
}
```

---

#### `PUT /api/users/me/password`

變更密碼（僅限帳密登入的用戶，OAuth 用戶回傳 403）。**需認證**

**Request Body：**
```json
{
  "current_password": "oldpassword",
  "new_password": "newpassword123",     // 6-100 字元
  "confirm_password": "newpassword123"
}
```

---

#### `GET /api/users/active`

取得所有活躍用戶列表（用於指派選擇器）。**需認證**

**回應 `200`：**
```json
{
  "users": [
    { "id": "uuid", "name": "Alice", "avatar_url": null }
  ]
}
```

---

### AI / 全域總覽

#### `GET /api/ai/overview`

取得所有專案的全面總覽 — **推薦 AI Agent 或儀表板使用此端點一次取得全貌。**

**需認證**

```bash
curl -H "Authorization: Bearer pb_YOUR_KEY" \
  https://your-domain/api/ai/overview
```

**回應 `200`：**
```json
{
  "total_projects": 3,
  "projects": [
    {
      "id": "uuid",
      "name": "My Project",
      "status": "active",
      "columns": [
        { "id": "uuid", "name": "待辦", "color": "#EF4444", "position": 0, "card_count": 5 }
      ],
      "stats": {
        "total_cards": 20,
        "completed_cards": 8,
        "overdue_cards": 2,
        "avg_progress": 45
      },
      "phases": [...],
      "recent_cards": [
        {
          "id": "uuid",
          "card_number": 5,
          "title": "Latest task",
          "progress": 70,
          "priority": "high",
          "column_name": "進行中",
          "assignees": [{ "id": "uuid", "name": "Alice" }]
        }
      ]
    }
  ]
}
```

---

### Admin（管理員）

所有管理員端點都需要 `role = "admin"` 的已認證用戶。

#### `GET /api/admin/stats`

取得系統統計資料。

**回應 `200`：**
```json
{
  "total_users": 50,
  "active_users": 45,
  "disabled_users": 5,
  "total_projects": 12,
  "total_cards": 340,
  "users_this_month": 3,
  "credentials_users": 40,
  "discord_users": 10
}
```

---

#### `GET /api/admin/users`

取得分頁、可篩選、可排序的用戶列表。

| 參數 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `search` | string | `""` | 搜尋 name 或 email |
| `role` | string | `""` | `"user"` 或 `"admin"` |
| `is_active` | string | `""` | `"true"` 或 `"false"` |
| `page` | integer | `1` | 頁碼（1-based） |
| `limit` | integer | `20` | 每頁筆數（最多 100） |
| `sort` | string | `"created_at"` | 排序欄位 |
| `order` | string | `"desc"` | `"asc"` 或 `"desc"` |

---

#### `PATCH /api/admin/users/[id]`

編輯用戶名稱、角色或啟用狀態。

**限制：** 管理員不能停用自己、不能降級自己、不能移除最後一個管理員。

---

#### `POST /api/admin/users/[id]/reset-password`

強制重設用戶密碼（設定 `force_password_change = true`）。

---

#### `POST /api/admin/users/[id]/generate-reset-link`

產生密碼重設連結（不寄送 email），有效期 60 分鐘。

---

#### `GET /api/admin/projects`

取得所有專案含統計資料（卡片數、成員數、建立者名稱）。

---

### API Key 管理

所有端點僅限管理員 JWT session，不接受 API Key 認證。

#### `GET /api/ai/keys`

列出所有 API Key（僅 metadata，不含明文）。

---

#### `POST /api/ai/keys`

建立新 API Key。**明文僅回傳一次。**

**Request Body：**
```json
{
  "name": "CI Integration",      // 必填，最多 100 字元
  "permissions": "read_only",    // 選填："full"|"read_only"，預設 "full"
  "expires_at": "2027-01-01"     // 選填
}
```

**回應 `200`：**
```json
{
  "success": true,
  "key": { "id": "uuid", "name": "CI Integration", ... },
  "api_key": "pb_a1b2c3d4e5f6...",
  "warning": "請立即複製此 API Key，之後將無法再查看明文。"
}
```

---

#### `DELETE /api/ai/keys`

撤銷 API Key。

**Request Body：** `{ "key_id": "uuid" }`

---

## 常見使用情境

### AI Agent 快速取得全貌

```bash
# 一次呼叫取得所有專案的狀態、進度、最近變更
curl -H "Authorization: Bearer pb_KEY" /api/ai/overview
```

### 建立卡片完整流程

```bash
# 1. 取得專案欄位
curl /api/projects/{project_id}/columns

# 2. 在「待辦」欄位建立卡片（可同時指定階段）
curl -X POST -H "Authorization: Bearer pb_KEY" \
  -H "Content-Type: application/json" \
  -d '{"column_id": "column-uuid", "title": "新任務", "phase_id": "phase-uuid"}' \
  /api/cards

# 3. 更新卡片詳情
curl -X PUT -H "Authorization: Bearer pb_KEY" \
  -H "Content-Type: application/json" \
  -d '{"priority": "high", "due_date": "2026-04-01", "assignee_id": "user-uuid"}' \
  /api/cards/{card_id}

# 4. 加上標籤
curl -X POST -H "Authorization: Bearer pb_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tag_id": "tag-uuid"}' \
  /api/cards/{card_id}/tags
```

### 移動卡片到「已完成」

```bash
curl -X POST -H "Authorization: Bearer pb_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "card_id": "card-uuid",
    "source_column_id": "in-progress-column-uuid",
    "dest_column_id": "done-column-uuid",
    "source_index": 0,
    "dest_index": 0
  }' \
  /api/cards/move
```

---

## 架構注意事項（Pitfalls）

### 雙層認證架構

本專案有**兩層認證**，開發或整合時必須理解：

```
請求進來
  │
  ▼
┌─────────────────────────────────────────────┐
│ 第一層：Edge Middleware（src/proxy.ts）       │
│ · 在 Edge Runtime 執行，先於 route handler   │
│ · 用 Auth.js session（JWT cookie）檢查       │
│ · 根據路徑決定放行、擋下或重導               │
└─────────────────────────────────────────────┘
  │ 通過後
  ▼
┌─────────────────────────────────────────────┐
│ 第二層：Route Handler（requireAuth()）       │
│ · 在 Node.js Runtime 執行                    │
│ · 支援 API Key（Bearer pb_）+ JWT session   │
│ · 實際的業務邏輯認證                         │
└─────────────────────────────────────────────┘
```

### Pitfall #1：Middleware 攔截 API Key 請求

**問題：** `src/proxy.ts` 的 `protectedPrefixes` 列出了需認證的路徑（如 `/api/cards`、`/api/columns`）。Middleware 在 Edge Runtime 用 Auth.js session 檢查，**不認 API Key**。所以帶 `Authorization: Bearer pb_xxx` 但沒有 session cookie 的請求會被直接 401，根本到不了 route handler。

**影響範圍：**
- `/api/cards` — 被 middleware 保護
- `/api/columns` — 被 middleware 保護
- `/api/users` — 被 middleware 保護
- `/api/projects` — 被 middleware 保護
- `/api/notifications` — 被 middleware 保護

**不受影響的路徑：**
- `/api/ai/*` — 不在 `protectedPrefixes` 中，走到 middleware 最後的「其他路由：放行」
- `/api/health` — 在 `publicExact` 中

**解決方式（已實作）：** 在 middleware 最前面加一條規則：帶 `Bearer pb_` header 的 API 請求直接放行，由 route handler 負責完整驗證。

```typescript
// src/proxy.ts 第 73-76 行
if (isApiRoute(pathname) && req.headers.get('authorization')?.startsWith('Bearer pb_')) {
  return NextResponse.next()
}
```

### Pitfall #2：新增受保護路由時的 checklist

當你新增一個需要認證的 API route 時，要注意：

1. **不需要**手動加到 `protectedPrefixes` — API Key 已在 middleware 層放行，route handler 的 `requireAuth()` 會處理認證
2. 如果路徑不在 `protectedPrefixes` 中，未帶認證的請求會通過 middleware、由 route handler 的 `requireAuth()` 回 401
3. 如果路徑在 `protectedPrefixes` 中，未帶認證的請求會被 middleware 攔截（API 回 401、頁面重導到 /login）
4. **兩種行為結果相同**（都是 401），差別只在哪一層擋下

### Pitfall #3：除錯認證問題

如果 API Key 認證失敗，依序檢查：

| 檢查項目 | 如何確認 |
|----------|----------|
| Header 格式正確 | 必須是 `Authorization: Bearer pb_xxx`，不是 `x-api-key` |
| Middleware 是否攔截 | route handler 有沒有收到請求（加 console.log 在 handler 開頭） |
| API Key 是否 active | 查 DB：`SELECT is_active, expires_at FROM api_keys WHERE key_prefix LIKE 'pb_xxx%'` |
| 帳號是否啟用 | 查 DB：`SELECT is_active FROM profiles WHERE id = <user_id>` |
| 權限是否足夠 | `read_only` 的 key 不能 POST/PUT/DELETE（回 403 不是 401） |

### Pitfall #4：Edge Runtime 限制

`src/proxy.ts` 在 Edge Runtime 執行，有以下限制：
- **不能使用 `pg` 模組** — 無法直接查資料庫
- **不能做 API Key hash 比對** — 所以 API Key 驗證只能交給 route handler
- **只能用 JWT token 中的資訊** — 如 `session.user.role`
