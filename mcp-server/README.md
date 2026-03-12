# Uphouse MCP Server

MCP Server for [Uphouse Dashboard](https://dashboard.uphousetw.com), enabling AI tools to manage projects, phases, and cards via natural language.

## Tools Available

| Tool | Description |
|------|-------------|
| `uphouse_list_projects` | List all projects |
| `uphouse_create_project` | Create a new project |
| `uphouse_list_phases` | List phases in a project |
| `uphouse_create_phase` | Create a new phase |
| `uphouse_list_cards` | List cards in a phase |
| `uphouse_create_card` | Create a single card |
| `uphouse_update_card` | Update a card's fields |
| `uphouse_bulk_create_cards` | Create multiple cards at once |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your actual tokens
```

Required variables:
- `UPHOUSE_API_TOKEN` — your `pb_...` token from the dashboard
- `MCP_SECRET_TOKEN` — a secret you choose to protect the MCP endpoint

### 3. Build

```bash
npm run build
```

### 4. Run locally

```bash
npm start
```

---

## Deploy to Zeabur

1. Push this repo to GitHub
2. In Zeabur: New Project → Deploy from GitHub → select this repo
3. Set environment variables in Zeabur dashboard:
   - `UPHOUSE_API_TOKEN`
   - `MCP_SECRET_TOKEN`
   - `TRANSPORT=http`
4. Zeabur auto-sets `PORT`
5. Get your subdomain: `uphouse-mcp.zeabur.app`

---

## Connect to AI Tools

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "uphouse": {
      "url": "https://uphouse-mcp.zeabur.app/mcp",
      "headers": {
        "Authorization": "Bearer your_MCP_SECRET_TOKEN"
      }
    }
  }
}
```

### OpenClaw (`openclaw.json`)

```json
{
  "mcpServers": {
    "uphouse": {
      "url": "https://uphouse-mcp.zeabur.app/mcp",
      "headers": {
        "Authorization": "Bearer your_MCP_SECRET_TOKEN"
      }
    }
  }
}
```

### Cursor / Windsurf

Add the same URL + Authorization header in the MCP settings panel.

---

## Usage Examples

Once connected, you can say to any AI tool:

- "列出所有 Uphouse 專案"
- "在拾壹間專案建立一個叫做『施工階段』的 phase"
- "把八宅專案的所有 phase 結構複製到拾壹間"
- "在設計階段新增 10 張 punch list cards"
