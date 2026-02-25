import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// POST /api/cards
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { column_id, title } = body

    // Get max position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM cards WHERE column_id = $1',
      [column_id]
    )
    const position = posResult[0]?.pos || 0

    const result = await query(
      'INSERT INTO cards (column_id, title, position) VALUES ($1, $2, $3) RETURNING *',
      [column_id, title, position]
    )

    return NextResponse.json(result[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 })
  }
}
