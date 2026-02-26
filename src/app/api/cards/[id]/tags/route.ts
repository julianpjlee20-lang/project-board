import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/cards/[id]/tags
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params
    
    const tags = await query(`
      SELECT t.* FROM tags t
      JOIN card_tags ct ON t.id = ct.tag_id
      WHERE ct.card_id = $1
      ORDER BY t.name
    `, [cardId])

    return NextResponse.json(tags)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch card tags' }, { status: 500 })
  }
}

// POST /api/cards/[id]/tags - add tag to card
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params
    const body = await request.json()
    const { tag_id } = body

    await query(
      'INSERT INTO card_tags (card_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [cardId, tag_id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to add tag' }, { status: 500 })
  }
}

// DELETE /api/cards/[id]/tags - remove tag from card
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params
    const { searchParams } = new URL(request.url)
    const tag_id = searchParams.get('tag_id')

    if (!tag_id) {
      return NextResponse.json({ error: 'Tag ID required' }, { status: 400 })
    }

    await query('DELETE FROM card_tags WHERE card_id = $1 AND tag_id = $2', [cardId, tag_id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 })
  }
}
