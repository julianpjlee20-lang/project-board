import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/projects
export async function GET() {
  try {
    const projects = await query("SELECT * FROM projects ORDER BY created_at DESC")
    return NextResponse.json(projects)
  } catch (error: any) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch projects',
      detail: error.message || String(error)
    }, { status: 500 })
  }
}

// POST /api/projects
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description } = body

    // Insert project
    const result = await query(
      "INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING id",
      [name, description || null]
    )

    const projectId = result[0]?.id

    if (projectId) {
      // Create default columns
      await query(
        "INSERT INTO columns (project_id, name, position) VALUES ($1, 'To Do', 0), ($1, 'In Progress', 1), ($1, 'Done', 2)",
        [projectId]
      )
    }

    return NextResponse.json({ success: true, id: projectId })
  } catch (error: any) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({ 
      error: 'Failed to create project',
      detail: error.message || String(error)
    }, { status: 500 })
  }
}

// PUT /api/projects - Initialize database
export async function PUT() {
  try {
    // Create all tables
    await query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        avatar_url TEXT,
        line_user_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `, [])

    await query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        created_by UUID REFERENCES profiles(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `, [])

    await query(`
      CREATE TABLE IF NOT EXISTS columns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects ON DELETE CASCADE,
        name TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `, [])

    await query(`
      CREATE TABLE IF NOT EXISTS cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        column_id UUID REFERENCES columns ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        due_date TIMESTAMP WITH TIME ZONE,
        position INTEGER NOT NULL,
        created_by UUID REFERENCES profiles(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `, [])

    await query(`
      CREATE TABLE IF NOT EXISTS card_assignees (
        card_id UUID REFERENCES cards ON DELETE CASCADE,
        user_id UUID REFERENCES profiles ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (card_id, user_id)
      )
    `, [])

    await query(`
      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#4EA7FC'
      )
    `, [])

    await query(`
      CREATE TABLE IF NOT EXISTS card_tags (
        card_id UUID REFERENCES cards ON DELETE CASCADE,
        tag_id UUID REFERENCES tags ON DELETE CASCADE,
        PRIMARY KEY (card_id, tag_id)
      )
    `, [])

    await query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID REFERENCES cards ON DELETE CASCADE,
        author_id UUID REFERENCES profiles ON DELETE SET NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `, [])

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
    `, [])

    return NextResponse.json({ success: true, message: 'Database initialized' })
  } catch (error: any) {
    console.error('PUT /api/projects error:', error)
    return NextResponse.json({ 
      error: 'Failed to initialize database',
      detail: error.message || String(error)
    }, { status: 500 })
  }
}
