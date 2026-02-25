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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
