import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'

// GET /api/projects/[id]/columns
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()

    const { id } = await params

    // Get columns
    const columns = await query(
      'SELECT * FROM columns WHERE project_id = $1 ORDER BY position',
      [id]
    )
    
    // Get all cards in one query (eliminates N+1)
    const columnIds = columns.map((c: { id: number }) => c.id)
    const allCards = columnIds.length > 0 ? await query(`
      SELECT c.id, c.card_number, c.title, c.description, c.progress,
             c.priority, c.due_date, c.planned_completion_date,
             c.actual_completion_date, c.start_date, c.position,
             c.phase_id, c.column_id, c.created_at, c.rolling_due_date,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', ca.user_id, 'name', p.name)) FILTER (WHERE ca.user_id IS NOT NULL), '[]') as assignees,
        COALESCE(
          (SELECT json_agg(json_build_object('id', s.id, 'title', s.title, 'is_completed', s.is_completed, 'position', s.position, 'due_date', s.due_date, 'assignee_id', s.assignee_id, 'assignee_name', sp.name) ORDER BY s.position)
           FROM subtasks s LEFT JOIN profiles sp ON s.assignee_id = sp.id WHERE s.card_id = c.id),
          '[]'
        ) as subtasks,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM tags t JOIN card_tags ct ON t.id = ct.tag_id WHERE ct.card_id = c.id),
          '[]'
        ) as tags
      FROM cards c
      LEFT JOIN card_assignees ca ON c.id = ca.card_id
      LEFT JOIN profiles p ON ca.user_id = p.id
      WHERE c.column_id = ANY($1::int[])
      GROUP BY c.id
      ORDER BY c.position
    `, [columnIds]) : []

    // Group cards by column in JS
    for (const col of columns) {
      col.cards = allCards.filter((c: { column_id: number }) => c.column_id === col.id)
    }
    
    return NextResponse.json(columns)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch columns' }, { status: 500 })
  }
}

// POST /api/projects/[id]/columns
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { id: projectId } = await params
    const body = await request.json()
    const { name, color, position } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Column name is required' }, { status: 400 })
    }

    // Get max position if not provided
    let finalPosition = position
    if (finalPosition === undefined || finalPosition === null) {
      const posResult = await query(
        'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM columns WHERE project_id = $1',
        [projectId]
      )
      finalPosition = posResult[0]?.pos || 0
    }

    const result = await query(
      'INSERT INTO columns (project_id, name, color, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, name.trim(), color || '#4EA7FC', finalPosition]
    )

    return NextResponse.json(result[0])
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create column' }, { status: 500 })
  }
}
