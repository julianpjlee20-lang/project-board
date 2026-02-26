import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/columns
export async function GET() {
  try {
    const columns = await query("SELECT * FROM columns ORDER BY position")
    return NextResponse.json(columns)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch columns' }, { status: 500 })
  }
}

// POST /api/columns
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_id, name, color } = body

    // Get max position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM columns WHERE project_id = $1',
      [project_id]
    )
    const position = posResult[0]?.pos || 0

    const result = await query(
      'INSERT INTO columns (project_id, name, color, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_id, name, color || '#4EA7FC', position]
    )

    return NextResponse.json(result[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create column' }, { status: 500 })
  }
}

// PUT /api/columns - update column
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, color, position } = body

    const result = await query(
      'UPDATE columns SET name = COALESCE($1, name), color = COALESCE($2, color), position = COALESCE($3, position) WHERE id = $4 RETURNING *',
      [name, color, position, id]
    )

    return NextResponse.json(result[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update column' }, { status: 500 })
  }
}

// DELETE /api/columns
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Column ID required' }, { status: 400 })
    }

    await query('DELETE FROM columns WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete column' }, { status: 500 })
  }
}
