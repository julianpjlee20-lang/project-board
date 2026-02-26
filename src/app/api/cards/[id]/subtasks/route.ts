import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/cards/[id]/subtasks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const subtasks = await query(
      'SELECT * FROM subtasks WHERE card_id = $1 ORDER BY position',
      [id]
    )

    return NextResponse.json(subtasks)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch subtasks' }, { status: 500 })
  }
}

// POST /api/cards/[id]/subtasks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params
    const body = await request.json()
    const { title } = body

    // Get max position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM subtasks WHERE card_id = $1',
      [cardId]
    )
    const position = posResult[0]?.pos || 0

    const result = await query(
      'INSERT INTO subtasks (card_id, title, position) VALUES ($1, $2, $3) RETURNING *',
      [cardId, title, position]
    )

    return NextResponse.json(result[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 })
  }
}

// PUT /api/cards/[id]/subtasks
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params
    const body = await request.json()
    const { subtask_id, title, is_completed } = body

    const result = await query(
      'UPDATE subtasks SET title = COALESCE($1, title), is_completed = COALESCE($2, is_completed) WHERE id = $3 AND card_id = $4 RETURNING *',
      [title, is_completed, subtask_id, cardId]
    )

    return NextResponse.json(result[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update subtask' }, { status: 500 })
  }
}

// DELETE /api/cards/[id]/subtasks
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params
    const { searchParams } = new URL(request.url)
    const subtask_id = searchParams.get('subtask_id')

    if (!subtask_id) {
      return NextResponse.json({ error: 'Subtask ID required' }, { status: 400 })
    }

    await query('DELETE FROM subtasks WHERE id = $1 AND card_id = $2', [subtask_id, cardId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete subtask' }, { status: 500 })
  }
}
