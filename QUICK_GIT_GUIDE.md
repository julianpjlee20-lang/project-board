# Git 快速指南

## 基本工作流程

### 1. 檢查狀態
```bash
git status
```

### 2. 查看修改內容
```bash
git diff
```

### 3. 加入檔案到暫存區
```bash
# 加入所有變更
git add .

# 或加入特定檔案
git add src/app/page.tsx
```

### 4. 提交變更
```bash
git commit -m "修復：資料庫連接池設定問題"
```

### 5. 推送到 GitHub
```bash
git push origin main
```

---

## 常用指令

### 查看提交歷史
```bash
git log --oneline -10
```

### 撤銷還未 commit 的修改
```bash
# 撤銷特定檔案
git checkout -- src/app/page.tsx

# 撤銷所有修改（危險！）
git reset --hard HEAD
```

### 拉取最新程式碼
```bash
git pull origin main
```

### 建立新分支
```bash
# 建立並切換到新分支
git checkout -b feature/new-feature

# 推送新分支到 GitHub
git push -u origin feature/new-feature
```

### 切換分支
```bash
git checkout main
git checkout feature/new-feature
```

### 合併分支
```bash
# 先切換到 main
git checkout main

# 合併其他分支
git merge feature/new-feature

# 推送
git push origin main
```

---

## 提交訊息規範

建議使用以下格式：

- `新增：新增使用者登入功能`
- `修復：修正卡片拖放錯誤`
- `更新：更新 README 文件`
- `重構：重構資料庫連接邏輯`
- `優化：優化卡片載入性能`
- `測試：新增單元測試`
- `文件：更新 API 文件`

---

## 目前的遠端 Repository

- URL: https://github.com/julianpjlee20-lang/project-board.git
- 分支: main

---

## 緊急救援

### 如果 commit 了不該 commit 的內容
```bash
# 撤銷最後一次 commit（保留修改）
git reset --soft HEAD~1

# 撤銷最後一次 commit（放棄修改，危險！）
git reset --hard HEAD~1
```

### 如果 push 了錯誤的內容到 GitHub
```bash
# 強制推送（危險！會覆蓋遠端）
git push --force origin main
```

⚠️ 注意：使用 `--force` 前請確認沒有其他人正在協作！

---

## 協作流程

如果有其他人一起開發：

1. 每次開始工作前先拉取最新程式碼
   ```bash
   git pull origin main
   ```

2. 建立自己的功能分支
   ```bash
   git checkout -b feature/your-feature
   ```

3. 完成後推送並建立 Pull Request
   ```bash
   git push -u origin feature/your-feature
   ```

4. 在 GitHub 上建立 Pull Request 請求合併
