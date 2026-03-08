import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'

// POST /api/cards/move
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const body = await request.json()
    const { card_id, source_column_id, dest_column_id, source_index, dest_index } = body

    // Get the card
    const cards = await query('SELECT * FROM cards WHERE id = $1', [card_id])
    if (cards.length === 0) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Update the card's column and position
    await query(
      'UPDATE cards SET column_id = $1, position = $2, updated_at = NOW() WHERE id = $3',
      [dest_column_id, dest_index, card_id]
    )

    // Reorder other cards in source column
    if (source_column_id !== dest_column_id) {
      const sourceCards = await query(
        'SELECT id FROM cards WHERE column_id = $1 AND id != $2 ORDER BY position',
        [source_column_id, card_id]
      )
      
      if (sourceCards.length > 0) {
        const ids = sourceCards.map((c: { id: number }) => c.id)
        const positions = sourceCards.map((_: unknown, i: number) => i)
        await query(
          `UPDATE cards SET position = batch.pos
           FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS pos) AS batch
           WHERE cards.id = batch.id`,
          [ids, positions]
        )
      }
    }

    // Reorder cards in destination column
    const destCards = await query(
      'SELECT id FROM cards WHERE column_id = $1 ORDER BY position',
      [dest_column_id]
    )

    if (destCards.length > 0) {
      const ids = destCards.map((c: { id: number }) => c.id)
      const positions = destCards.map((_: unknown, i: number) => i)
      await query(
        `UPDATE cards SET position = batch.pos
         FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS pos) AS batch
         WHERE cards.id = batch.id`,
        [ids, positions]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to move card' }, { status: 500 })
  }
}
