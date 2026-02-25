import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// PUT /api/cards/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, assignee, due_date } = body

    // Update card
    await query(
      `UPDATE cards SET title = $1, description = $2, due_date = $3, updated_at = NOW() WHERE id = $4`,
      [title, description, due_date, id]
    )

    // Handle assignee
    if (assignee !== undefined) {
      // Remove existing assignees
      await query('DELETE FROM card_assignees WHERE card_id = $1', [id])
      
      if (assignee) {
        // Find or create profile
        let profiles = await query('SELECT id FROM profiles WHERE name = $1', [assignee])
        
        if (profiles.length === 0) {
          // Create new profile
          const newProfile = await query(
            'INSERT INTO profiles (id, name) VALUES (gen_random_uuid(), $1) RETURNING id',
            [assignee]
          )
          profiles = newProfile
        }
        
        if (profiles[0]) {
          await query(
            'INSERT INTO card_assignees (card_id, user_id) VALUES ($1, $2)',
            [id, profiles[0].id]
          )
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 })
  }
}
