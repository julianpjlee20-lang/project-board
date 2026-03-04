import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'

// POST /api/cards/reorder
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const body = await request.json()
    const { column_id, cards } = body

    // Update positions for all cards
    for (let i = 0; i < cards.length; i++) {
      await query(
        'UPDATE cards SET position = $1, column_id = $2 WHERE id = $3',
        [i, column_id, cards[i].id]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to reorder cards' }, { status: 500 })
  }
}
