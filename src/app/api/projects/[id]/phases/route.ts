import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createPhaseSchema, updatePhaseSchema, validateData } from '@/lib/validations'

interface PhaseRow {
  id: string
  project_id: string
  name: string
  color: string
  position: number
  created_at: string
  total_cards: number
  completed_cards: number
}

// GET /api/projects/[id]/phases
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    // Get phases with auto-calculated progress
    const phases = await query(`
      SELECT p.*,
        COUNT(c.id)::int AS total_cards,
        COUNT(c.id) FILTER (WHERE col.name ILIKE '%done%' OR col.name ILIKE '%完成%')::int AS completed_cards
      FROM phases p
      LEFT JOIN cards c ON c.phase_id = p.id
      LEFT JOIN columns col ON c.column_id = col.id
      WHERE p.project_id = $1
      GROUP BY p.id
      ORDER BY p.position
    `, [projectId])

    const result = (phases as PhaseRow[]).map((phase) => ({
      ...phase,
      progress: phase.total_cards > 0
        ? Math.round((phase.completed_cards / phase.total_cards) * 100)
        : 0
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/projects/[id]/phases error:', error)
    return NextResponse.json({ error: 'Failed to fetch phases' }, { status: 500 })
  }
}

// POST /api/projects/[id]/phases
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()

    const validation = validateData(createPhaseSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { name, color } = validation.data

    // Auto-assign position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM phases WHERE project_id = $1',
      [projectId]
    )
    const position = posResult[0]?.pos || 0

    const result = await query(
      'INSERT INTO phases (project_id, name, color, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, name, color || '#4EA7FC', position]
    )

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('POST /api/projects/[id]/phases error:', error)
    return NextResponse.json({ error: 'Failed to create phase' }, { status: 500 })
  }
}

// PUT /api/projects/[id]/phases
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params
    const body = await request.json()

    const validation = validateData(updatePhaseSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { id, name, color, position } = validation.data

    const sets: string[] = []
    const values: (string | number | undefined)[] = []
    let idx = 1

    if (name !== undefined) { sets.push(`name = $${idx++}`); values.push(name) }
    if (color !== undefined) { sets.push(`color = $${idx++}`); values.push(color) }
    if (position !== undefined) { sets.push(`position = $${idx++}`); values.push(position) }

    if (sets.length === 0) {
      return NextResponse.json({ error: '沒有要更新的欄位' }, { status: 400 })
    }

    values.push(id)
    await query(`UPDATE phases SET ${sets.join(', ')} WHERE id = $${idx}`, values)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PUT /api/projects/[id]/phases error:', error)
    return NextResponse.json({ error: 'Failed to update phase' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/phases
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少 phase id' }, { status: 400 })
    }

    await query('DELETE FROM phases WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/projects/[id]/phases error:', error)
    return NextResponse.json({ error: 'Failed to delete phase' }, { status: 500 })
  }
}
