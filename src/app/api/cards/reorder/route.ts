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
    if (cards.length > 0) {
      const ids = cards.map((c: { id: number }) => c.id)
      const positions = cards.map((_: unknown, i: number) => i)
      await query(
        `UPDATE cards SET position = batch.pos, column_id = $3
         FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS pos) AS batch
         WHERE cards.id = batch.id`,
        [ids, positions, column_id]
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
