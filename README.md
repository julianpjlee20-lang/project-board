# Project Board

團隊專案管理看板系統，使用 Next.js 16 + PostgreSQL 建立。

## 🚀 功能特色

### 核心功能
- ✅ **多專案管理** - 建立和管理多個專案看板
- ✅ **看板視圖** - 拖放式卡片管理（類似 Trello）
- ✅ **多種視圖** - Board / List / Calendar / Progress 四種視圖
- ✅ **任務管理** - 卡片、子任務、標籤、進度追蹤
- ✅ **協作功能** - 指派成員、評論、活動記錄
- ✅ **Discord 登入** - OAuth 身份驗證

### 技術棧
- **前端**: Next.js 16 (App Router) + React 19 + TypeScript
- **UI**: Tailwind CSS 4 + shadcn/ui
- **拖放**: @hello-pangea/dnd
- **後端**: Next.js API Routes
- **資料庫**: PostgreSQL

## 📦 安裝

```bash
# 1. 安裝依賴
npm install

# 2. 設定環境變數
cp .env.example .env
# 編輯 .env 並填入您的資料庫連線資訊

# 3. 啟動開發伺服器
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) 查看結果。

## 🔧 環境變數設定

建立 `.env` 檔案並設定以下變數：

```bash
# 資料庫連線
DATABASE_URL=postgresql://username:password@localhost:5432/project_board

# Discord OAuth（選用）
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
```

詳細設定請參考 [.env.example](.env.example)。

## 📖 資料庫結構

主要資料表：
- `projects` - 專案
- `columns` - 看板欄位
- `cards` - 任務卡片
- `comments` - 評論
- `activity` - 活動記錄
- `tags` - 標籤
- `subtasks` - 子任務

## 🎯 使用方式

### 建立專案
1. 前往專案列表頁面
2. 點擊「新增專案」
3. 輸入專案名稱

### 管理任務
1. 在看板中建立欄位（To Do / In Progress / Done）
2. 加入任務卡片
3. 拖放卡片到不同欄位
4. 點擊卡片查看詳情、加入描述、指派成員、設定截止日期

### 切換視圖
- **Board** - 看板視圖（拖放卡片）
- **List** - 列表視圖（表格形式）
- **Calendar** - 日曆視圖（查看截止日期）
- **Progress** - 進度視圖（統計圖表）

## 🛠️ 開發指令

```bash
# 開發模式
npm run dev

# 建置生產版本
npm run build

# 啟動生產伺服器（Port 8080）
npm start

# 程式碼檢查
npm run lint
```

## 📂 專案結構

```
project-board/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API Routes
│   │   ├── projects/     # 專案頁面
│   │   └── page.tsx      # 首頁
│   ├── components/       # React 元件
│   │   └── ui/           # shadcn/ui 元件
│   └── lib/              # 工具函式
│       └── db.ts         # 資料庫連線
├── public/               # 靜態資源
└── .env.example          # 環境變數範例
```

## 🐛 已知問題與改進計畫

請參考 Issues 頁面查看目前的問題和改進計畫。

## 📝 Git 使用指南

詳細的 Git 操作說明請參考 [QUICK_GIT_GUIDE.md](QUICK_GIT_GUIDE.md)。

## 📄 授權

MIT License

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request！

---

**建立於 2025 年** 🚀
