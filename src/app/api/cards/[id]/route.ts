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
    let { title, description, assignee, due_date } = body

    // Fix: Convert empty string to null for due_date
    if (due_date === '') {
      due_date = null
    }

    // Get old card data for activity log
    const oldCard = await query('SELECT * FROM cards WHERE id = $1', [id])
    const oldTitle = oldCard[0]?.title
    const oldDescription = oldCard[0]?.description
    const oldDueDate = oldCard[0]?.due_date

    // Update card
    await query(
      `UPDATE cards SET title = $1, description = $2, due_date = $3, updated_at = NOW() WHERE id = $4`,
      [title, description, due_date, id]
    )

    // Activity log: Title changed
    if (oldTitle !== title) {
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [oldCard[0]?.column_id ? (await query('SELECT project_id FROM columns WHERE id = $1', [oldCard[0].column_id]))[0]?.project_id : null, id, 'updated', 'title', oldTitle, title]
      )
    }

    // Activity log: Description changed
    if (oldDescription !== description) {
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [oldCard[0]?.column_id ? (await query('SELECT project_id FROM columns WHERE id = $1', [oldCard[0].column_id]))[0]?.project_id : null, id, 'updated', 'description', oldDescription ? '有描述' : '無描述', description ? '有描述' : '無描述']
      )
    }

    // Activity log: Due date changed
    if (String(oldDueDate) !== String(due_date)) {
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [oldCard[0]?.column_id ? (await query('SELECT project_id FROM columns WHERE id = $1', [oldCard[0].column_id]))[0]?.project_id : null, id, 'updated', 'due_date', oldDueDate ? oldDueDate.split('T')[0] : '無', due_date ? due_date.split('T')[0] : '無']
      )
    }

    // Handle assignee
    if (assignee !== undefined) {
      // Remove existing assignees
      await query('DELETE FROM card_assignees WHERE card_id = $1', [id])
      
      if (assignee) {
        // Find or create profile
        let profiles = await query('SELECT id FROM profiles WHERE name = $1', [assignee])
        
        if (profiles.length === 0) {
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
          
          // Activity log: Assigned
          await query(
            'INSERT INTO activity_logs (project_id, card_id, action, target, new_value) VALUES ($1, $2, $3, $4, $5)',
            [oldCard[0]?.column_id ? (await query('SELECT project_id FROM columns WHERE id = $1', [oldCard[0].column_id]))[0]?.project_id : null, id, 'assigned', 'assignee', assignee]
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
