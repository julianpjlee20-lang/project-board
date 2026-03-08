import { NextResponse } from "next/server"

const INSTRUCTIONS = `# Project Board API — AI Agent 指引

## 你是什麼
你是一個 AI 助手，連接到 Project Board（團隊專案管理看板系統）的 API。你可以查看、建立、更新專案中的任務卡片。

## 認證
所有寫入操作需要 API Key。在每個請求的 Header 中加入：
Authorization: Bearer pb_YOUR_API_KEY

## 快速上手（推薦順序）

### 第一步：了解全貌
GET /api/ai/overview
→ 一次取得所有專案的狀態、欄位、統計、最近卡片

### 第二步：查看特定專案的看板
GET /api/projects/{project_id}/columns
→ 取得該專案所有欄位和卡片（含 assignees、subtasks、tags）

### 第三步：操作卡片
- 建立卡片：POST /api/cards { "column_id": "uuid", "title": "任務名稱" }
- 更新卡片：PUT /api/cards/{id} { "progress": 80, "priority": "high" }
- 移動卡片：POST /api/cards/move { "card_id": "uuid", "source_column_id": "uuid", "dest_column_id": "uuid", "source_index": 0, "dest_index": 0 }
- 批次更新：POST /api/ai/batch { "updates": [{ "card_id": "uuid", "progress": 100 }] }

## 核心端點速查

### 讀取（GET，部分不需認證）
| 端點 | 用途 |
|------|------|
| /api/health | 系統健康檢查 |
| /api/projects | 所有專案列表 |
| /api/projects/{id}/columns | 專案看板（含卡片完整資料） |
| /api/cards/{id} | 單一卡片詳情 |
| /api/ai/overview | 全域總覽（推薦） |
| /api/calendar | 跨專案行事曆 |
| /api/projects/{id}/phases | 專案階段 |
| /api/projects/{id}/tags | 專案標籤 |
| /api/users/active | 可指派的用戶列表 |

### 寫入（需認證 + 寫入權限）
| 端點 | 方法 | 用途 |
|------|------|------|
| /api/cards | POST | 建立卡片 |
| /api/cards/{id} | PUT | 更新卡片欄位 |
| /api/cards/{id} | DELETE | 刪除卡片 |
| /api/cards/move | POST | 移動卡片到其他欄位 |
| /api/ai/batch | POST | 批次更新多張卡片（最多 50 筆） |
| /api/cards/{id}/subtasks | POST | 建立子任務 |
| /api/cards/{id}/subtasks | PUT | 更新子任務 |
| /api/cards/{id}/tags | POST | 為卡片加標籤 |
| /api/projects | POST | 建立專案 |
| /api/columns | POST/PUT | 建立/更新欄位 |

## 資料結構重點
- **Card.priority**: "low" | "medium" | "high"
- **Card.progress**: 0-100 整數
- **日期格式**: "YYYY-MM-DD"
- **Card.column_id**: 卡片所屬欄位（決定卡片在看板的位置）
- **Card.phase_id**: 卡片所屬階段（可為 null）

## 錯誤處理
- 401: 未認證 → 檢查 API Key 是否正確
- 403: 權限不足 → 可能是 read_only 的 key 嘗試寫入
- 400: 輸入驗證失敗 → 檢查 response body 的 details 欄位
- 404: 資源不存在

## 完整 API 文件
GET /api/docs → 取得完整的 Markdown 格式 API 參考手冊
GET /api/openapi → 取得 OpenAPI 3.1 JSON 規格（機器可讀）

## 最佳實踐
1. 優先用 /api/ai/overview 取得全貌，不要逐一查詢每個專案
2. 批次操作用 /api/ai/batch，不要逐一更新每張卡片
3. 移動卡片用 /api/cards/move，不要直接改 column_id
4. 建立卡片前先用 /api/projects/{id}/columns 取得欄位 UUID
`

export async function GET() {
  return new NextResponse(INSTRUCTIONS, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
