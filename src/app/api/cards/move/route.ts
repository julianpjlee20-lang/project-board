import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// POST /api/cards/move
export async function POST(request: NextRequest) {
  try {
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
      
      for (let i = 0; i < sourceCards.length; i++) {
        await query(
          'UPDATE cards SET position = $1 WHERE id = $2',
          [i, sourceCards[i].id]
        )
      }
    }

    // Reorder cards in destination column
    const destCards = await query(
      'SELECT id FROM cards WHERE column_id = $1 ORDER BY position',
      [dest_column_id]
    )

    for (let i = 0; i < destCards.length; i++) {
      await query(
        'UPDATE cards SET position = $1 WHERE id = $2',
        [i, destCards[i].id]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to move card' }, { status: 500 })
  }
}
