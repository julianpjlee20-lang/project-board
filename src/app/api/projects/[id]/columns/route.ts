import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/projects/[id]/columns
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Get columns
    const columns = await query(
      'SELECT * FROM columns WHERE project_id = $1 ORDER BY position',
      [id]
    )
    
    // Get cards for each column
    for (const col of columns) {
      const cards = await query(`
        SELECT c.*, 
          COALESCE(json_agg(DISTINCT jsonb_build_object('id', ca.user_id, 'name', p.name)) FILTER (WHERE ca.user_id IS NOT NULL), '[]') as assignees,
          COALESCE(json_agg(DISTINCT jsonb_build_object('id', cmt.id, 'content', cmt.content, 'author_name', p2.name)) FILTER (WHERE cmt.id IS NOT NULL), '[]') as comments
        FROM cards c
        LEFT JOIN card_assignees ca ON c.id = ca.card_id
        LEFT JOIN profiles p ON ca.user_id = p.id
        LEFT JOIN comments cmt ON c.id = cmt.card_id
        LEFT JOIN profiles p2 ON cmt.author_id = p2.id
        WHERE c.column_id = $1
        GROUP BY c.id
        ORDER BY c.position
      `, [col.id])
      col.cards = cards
    }
    
    return NextResponse.json(columns)
  } catch (error) {
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
    console.error(error)
    return NextResponse.json({ error: 'Failed to create column' }, { status: 500 })
  }
}
