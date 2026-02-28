import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createColumnSchema, updateColumnSchema, deleteColumnSchema, validateData } from '@/lib/validations'

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

    // Zod 驗證
    const validation = validateData(createColumnSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { project_id, name, color } = validation.data

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

    // Zod 驗證
    const validation = validateData(updateColumnSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { id, name, color, position } = validation.data

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

    // Zod 驗證
    const validation = validateData(deleteColumnSchema, { id })
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    await query('DELETE FROM columns WHERE id = $1', [validation.data.id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete column' }, { status: 500 })
  }
}
