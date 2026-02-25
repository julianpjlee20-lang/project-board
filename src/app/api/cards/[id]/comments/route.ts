import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// POST /api/cards/[id]/comments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { content, author_name } = body

    // Find or create author
    let authorId = null
    if (author_name) {
      let profiles = await query('SELECT id FROM profiles WHERE name = $1', [author_name])
      
      if (profiles.length === 0) {
        const newProfile = await query(
          'INSERT INTO profiles (id, name) VALUES (gen_random_uuid(), $1) RETURNING id',
          [author_name]
        )
        profiles = newProfile
      }
      
      if (profiles[0]) {
        authorId = profiles[0].id
      }
    }

    // Insert comment
    await query(
      'INSERT INTO comments (card_id, author_id, content) VALUES ($1, $2, $3)',
      [id, authorId, content]
    )

    // Activity log: Commented
    const card = await query('SELECT column_id FROM cards WHERE id = $1', [id])
    const column = card[0] ? await query('SELECT project_id FROM columns WHERE id = $1', [card[0].column_id]) : null
    
    if (column?.[0]) {
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, new_value) VALUES ($1, $2, $3, $4, $5)',
        [column[0].project_id, id, 'commented', 'comment', author_name || 'Anonymous']
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
