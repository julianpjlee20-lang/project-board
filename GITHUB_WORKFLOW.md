# GitHub 工作流程指南

## 📥 從 GitHub Clone 新專案到本機

### 情境 1：在 GitHub 建立了新的 Repository

1. **在 GitHub 建立新專案**
   - 前往 https://github.com/new
   - 輸入專案名稱，例如：`my-new-project`
   - 選擇 Public 或 Private
   - （選用）加入 README、.gitignore
   - 點擊 "Create repository"

2. **Clone 到本機**
   ```bash
   # 進入您的專案目錄
   cd C:\Users\user\Desktop\Coding

   # Clone repository（使用您的 Token）
   git clone https://YOUR_GITHUB_TOKEN@github.com/julianpjlee20-lang/my-new-project.git

   # 進入專案目錄
   cd my-new-project
   ```

3. **開始開發**
   ```bash
   # 建立或修改檔案
   code .

   # 提交變更
   git add .
   git commit -m "初始提交"
   git push origin main
   ```

---

### 情境 2：在本機建立專案，推送到 GitHub

1. **在 GitHub 建立空的 Repository**
   - 前往 https://github.com/new
   - 建立 repository（**不要**勾選 Initialize with README）
   - 複製 repository URL

2. **在本機初始化 Git**
   ```bash
   # 進入您的專案目錄
   cd C:\Users\user\Desktop\Coding\my-local-project

   # 初始化 Git
   git init

   # 加入檔案
   git add .

   # 第一次提交
   git commit -m "初始提交"

   # 設定遠端 repository（使用 Token）
   git remote add origin https://YOUR_GITHUB_TOKEN@github.com/julianpjlee20-lang/my-local-project.git

   # 推送到 GitHub
   git push -u origin main
   ```

---

### 情境 3：Fork 別人的專案並開發

1. **在 GitHub 上 Fork 專案**
   - 前往別人的 repository
   - 點擊右上角 "Fork"
   - Fork 到您的帳號

2. **Clone 您 Fork 的版本**
   ```bash
   cd C:\Users\user\Desktop\Coding
   git clone https://YOUR_GITHUB_TOKEN@github.com/julianpjlee20-lang/forked-project.git
   cd forked-project
   ```

3. **設定上游 repository（追蹤原始專案）**
   ```bash
   git remote add upstream https://github.com/original-owner/original-project.git

   # 查看遠端設定
   git remote -v
   ```

4. **同步上游更新**
   ```bash
   # 拉取上游更新
   git fetch upstream

   # 合併到您的 main
   git checkout main
   git merge upstream/main

   # 推送到您的 Fork
   git push origin main
   ```

---

## 🔄 多專案工作流程

### 快速切換專案

```bash
# 專案 A
cd C:\Users\user\Desktop\Coding\project-board\project-board
git status
git pull origin main

# 專案 B
cd C:\Users\user\Desktop\Coding\another-project
git status
git pull origin main
```

### 使用分支開發功能

```bash
# 建立新分支
git checkout -b feature/new-feature

# 開發並提交
git add .
git commit -m "新增：新功能"

# 推送分支
git push -u origin feature/new-feature

# 在 GitHub 上建立 Pull Request

# 合併後刪除分支
git checkout main
git pull origin main
git branch -d feature/new-feature
```

---

## 🔐 Token 管理

### 您目前的 Token

```bash
YOUR_GITHUB_TOKEN
```

**有效期限**: 90 天（建立時設定）

### Token 過期後如何更新

1. **建立新 Token**
   - 前往 https://github.com/settings/tokens/new
   - 設定權限：`repo`
   - 複製新 Token

2. **更新本機設定**
   ```bash
   cd your-project

   # 更新 remote URL
   git remote set-url origin https://NEW_TOKEN@github.com/julianpjlee20-lang/your-project.git
   ```

3. **更新所有專案**
   ```bash
   # 可以寫一個腳本批次更新所有專案的 Token
   ```

---

## 📝 快速指令參考

### Clone 專案
```bash
git clone https://YOUR_GITHUB_TOKEN@github.com/julianpjlee20-lang/PROJECT_NAME.git
```

### 日常提交
```bash
git add .
git commit -m "描述"
git push origin main
```

### 拉取最新
```bash
git pull origin main
```

### 查看狀態
```bash
git status
git log --oneline -10
```

---

## 🚨 常見問題

### Q: Clone 時遇到 403 錯誤？
**A**: Token 可能過期或無效，請重新建立並更新。

### Q: 如何查看目前使用的 remote URL？
```bash
git remote -v
```

### Q: 如何查看 Token 是否設定正確？
```bash
git remote get-url origin
# 應該顯示包含 Token 的 URL
```

### Q: 多人協作時如何避免衝突？
1. 每次開始工作前先 `git pull`
2. 使用分支開發功能
3. 定期同步 main branch

---

**提示**: 所有使用 Token 的指令中，將 `YOUR_GITHUB_TOKEN` 替換成您的實際 Token。
