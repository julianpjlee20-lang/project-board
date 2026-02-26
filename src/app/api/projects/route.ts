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
