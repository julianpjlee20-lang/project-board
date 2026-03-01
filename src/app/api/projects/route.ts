import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createProjectSchema, validateData } from '@/lib/validations'

// GET /api/projects
export async function GET() {
  try {
    const projects = await query("SELECT * FROM projects ORDER BY created_at DESC")
    return NextResponse.json(projects)
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({
      error: 'Failed to fetch projects',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// POST /api/projects
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Zod 驗證
    const validation = validateData(createProjectSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { name, description, status, start_date, end_date } = validation.data

    // Insert project
    const result = await query(
      "INSERT INTO projects (name, description, status, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [name, description || null, status || 'active', start_date || null, end_date || null]
    )

    const projectId = result[0]?.id

    if (projectId) {
      // Create default columns with colors
      await query(
        "INSERT INTO columns (project_id, name, color, position) VALUES ($1, 'To Do', '#EF4444', 0), ($1, 'In Progress', '#F59E0B', 1), ($1, 'Done', '#10B981', 2)",
        [projectId]
      )
    }

    // 返回完整的專案資料
    return NextResponse.json({
      success: true,
      id: projectId,
      name,
      description: description || null,
      status: status || 'active',
      start_date: start_date || null,
      end_date: end_date || null
    })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({
      error: 'Failed to create project',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// PUT /api/projects - Initialize/Upgrade database
export async function PUT() {
  try {
    // Create profiles table
    await query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        avatar_url TEXT,
        line_user_id TEXT,
        discord_user_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    // Create projects table with new fields
    await query(`
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

    // Create columns table with color
    await query(`
      CREATE TABLE IF NOT EXISTS columns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#4EA7FC',
        position INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    // Create cards table with progress
    await query(`
      CREATE TABLE IF NOT EXISTS cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        column_id UUID REFERENCES columns ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        progress INTEGER DEFAULT 0,
        due_date TIMESTAMP WITH TIME ZONE,
        position INTEGER NOT NULL,
        created_by UUID REFERENCES profiles(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    // Create card_assignees table
    await query(`
      CREATE TABLE IF NOT EXISTS card_assignees (
        card_id UUID REFERENCES cards ON DELETE CASCADE,
        user_id UUID REFERENCES profiles ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (card_id, user_id)
      )
    `)

    // Create tags table
    await query(`
      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#4EA7FC'
      )
    `)

    // Create card_tags table
    await query(`
      CREATE TABLE IF NOT EXISTS card_tags (
        card_id UUID REFERENCES cards ON DELETE CASCADE,
        tag_id UUID REFERENCES tags ON DELETE CASCADE,
        PRIMARY KEY (card_id, tag_id)
      )
    `)

    // Create subtasks table
    await query(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID REFERENCES cards ON DELETE CASCADE,
        title TEXT NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE,
        position INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    // Drop comments table (feature removed)
    await query(`DROP TABLE IF EXISTS comments`)

    // Create activity_logs table
    await query(`
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

    // Create phases table
    await query(`
      CREATE TABLE IF NOT EXISTS phases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#4EA7FC',
        position INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    // 新增 profiles 欄位（LINE 登入用）
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS line_display_name TEXT`)
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS line_picture_url TEXT`)

    // 新增 profiles 欄位（Auth.js v5 + 未來 provider 擴展用）
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT`)
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_id TEXT`)
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook_id TEXT`)

    // 建立通知偏好表
    await query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        notify_assigned BOOLEAN DEFAULT TRUE,
        notify_due_soon BOOLEAN DEFAULT TRUE,
        notify_title_changed BOOLEAN DEFAULT FALSE,
        notify_moved BOOLEAN DEFAULT FALSE,
        quiet_hours_start INTEGER,
        quiet_hours_end INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `)

    // 建立通知佇列表
    await query(`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        project_name TEXT NOT NULL,
        card_title TEXT NOT NULL,
        action TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        sent BOOLEAN DEFAULT FALSE
      )
    `)

    // Add new columns if tables exist (for existing data)
    try {
      await query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'")
      await query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE")
      await query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE")
      await query("ALTER TABLE columns ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4EA7FC'")
      await query("ALTER TABLE cards ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0")
      await query("ALTER TABLE cards ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES phases ON DELETE SET NULL")
      await query("ALTER TABLE cards ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'")
      await query("ALTER TABLE cards ADD COLUMN IF NOT EXISTS planned_completion_date DATE")
      await query("ALTER TABLE cards ADD COLUMN IF NOT EXISTS actual_completion_date DATE")
      await query("ALTER TABLE cards ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE")
    } catch (_e) {
      // Ignore if columns already exist
    }

    return NextResponse.json({ success: true, message: 'Database upgraded successfully' })
  } catch (error) {
    console.error('PUT /api/projects error:', error)
    return NextResponse.json({
      error: 'Failed to upgrade database',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
