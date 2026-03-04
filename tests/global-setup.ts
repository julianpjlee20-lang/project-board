import { Pool } from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import bcrypt from 'bcryptjs'

/** E2E 測試用帳號 */
export const TEST_USER = {
  email: 'e2e-test@example.com',
  password: 'TestPass123!',
  name: 'E2E Test User',
}

/**
 * Playwright Global Setup
 * 在所有測試開始前，初始化測試資料庫的 schema + 建立測試用戶
 */
export default async function globalSetup() {
  // 載入 .env.test
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in .env.test')
  }

  console.log('\n🔧 [Global Setup] 初始化測試資料庫...')

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 20000,
  })

  try {
    // 清空所有表（按照依賴順序刪除）
    await pool.query('DROP TABLE IF EXISTS notification_dismissed CASCADE')
    await pool.query('DROP TABLE IF EXISTS notification_queue CASCADE')
    await pool.query('DROP TABLE IF EXISTS notification_preferences CASCADE')
    await pool.query('DROP TABLE IF EXISTS activity_logs CASCADE')
    await pool.query('DROP TABLE IF EXISTS subtasks CASCADE')
    await pool.query('DROP TABLE IF EXISTS card_tags CASCADE')
    await pool.query('DROP TABLE IF EXISTS tags CASCADE')
    await pool.query('DROP TABLE IF EXISTS card_assignees CASCADE')
    await pool.query('DROP TABLE IF EXISTS cards CASCADE')
    await pool.query('DROP TABLE IF EXISTS columns CASCADE')
    await pool.query('DROP TABLE IF EXISTS phases CASCADE')
    await pool.query('DROP TABLE IF EXISTS comments CASCADE')
    await pool.query('DROP TABLE IF EXISTS projects CASCADE')
    await pool.query('DROP TABLE IF EXISTS profiles CASCADE')

    // 重新建立所有表（含 auth 欄位）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        email TEXT UNIQUE,
        password_hash TEXT,
        avatar_url TEXT,
        line_user_id TEXT,
        discord_user_id TEXT,
        role TEXT DEFAULT 'user',
        is_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        force_password_change BOOLEAN DEFAULT FALSE
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        start_date DATE,
        end_date DATE,
        created_by UUID REFERENCES profiles(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS columns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#4EA7FC',
        position INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS phases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#4EA7FC',
        position INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        column_id UUID REFERENCES columns ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        progress INTEGER DEFAULT 0,
        due_date TIMESTAMP WITH TIME ZONE,
        position INTEGER NOT NULL,
        phase_id UUID REFERENCES phases ON DELETE SET NULL,
        priority TEXT DEFAULT 'medium',
        start_date TIMESTAMP WITH TIME ZONE,
        created_by UUID REFERENCES profiles(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS card_assignees (
        card_id UUID REFERENCES cards ON DELETE CASCADE,
        user_id UUID REFERENCES profiles ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (card_id, user_id)
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#4EA7FC'
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS card_tags (
        card_id UUID REFERENCES cards ON DELETE CASCADE,
        tag_id UUID REFERENCES tags ON DELETE CASCADE,
        PRIMARY KEY (card_id, tag_id)
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID REFERENCES cards ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE,
        position INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects ON DELETE CASCADE,
        card_id UUID REFERENCES cards ON DELETE CASCADE,
        user_id UUID REFERENCES profiles ON DELETE SET NULL,
        action TEXT NOT NULL,
        target TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_dismissed (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        dismiss_type TEXT NOT NULL CHECK (dismiss_type IN ('overdue', 'due_soon')),
        dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, card_id, dismiss_type)
      )
    `)

    // 建立 E2E 測試用戶（is_active = true，跳過審核）
    const passwordHash = await bcrypt.hash(TEST_USER.password, 10)
    await pool.query(
      `INSERT INTO profiles (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'admin', true)`,
      [TEST_USER.name, TEST_USER.email, passwordHash]
    )

    console.log('✅ [Global Setup] 測試資料庫 schema 初始化完成')
    console.log(`✅ [Global Setup] 測試用戶已建立: ${TEST_USER.email}`)
  } catch (error) {
    console.error('❌ [Global Setup] 測試資料庫初始化失敗:', error)
    throw error
  } finally {
    await pool.end()
  }
}
