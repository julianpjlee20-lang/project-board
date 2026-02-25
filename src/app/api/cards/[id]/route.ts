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

    // Get project_id
    const column = oldCard[0]?.column_id ? 
      await query('SELECT project_id FROM columns WHERE id = $1', [oldCard[0].column_id]) : null
    const projectId = column?.[0]?.project_id || null

    // Update card
    await query(
      `UPDATE cards SET title = $1, description = $2, due_date = $3, updated_at = NOW() WHERE id = $4`,
      [title, description, due_date, id]
    )

    // Activity log: Title changed
    if (oldTitle !== title) {
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '標題', oldTitle, title]
      )
    }

    // Activity log: Description changed
    if (oldDescription !== description) {
      const oldDesc = oldDescription ? (oldDescription.substring(0, 50) + (oldDescription.length > 50 ? '...' : '')) : '(空)'
      const newDesc = description ? (description.substring(0, 50) + (description.length > 50 ? '...' : '')) : '(空)'
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '描述', oldDesc, newDesc]
      )
    }

    // Activity log: Due date changed
    if (String(oldDueDate) !== String(due_date)) {
      const oldDate = oldDueDate ? oldDueDate.split('T')[0] : '(未設定)'
      const newDate = due_date ? due_date.split('T')[0] : '(未設定)'
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '截止日', oldDate, newDate]
      )
    }

    // Handle assignee
    if (assignee !== undefined) {
      // Get old assignee
      const oldAssignee = await query(
        'SELECT p.name FROM profiles p JOIN card_assignees ca ON p.id = ca.user_id WHERE ca.card_id = $1',
        [id]
      )
      const oldAssigneeName = oldAssignee[0]?.name || '(未指派)'

      // Remove existing assignees
      await query('DELETE FROM card_assignees WHERE card_id = $1', [id])
      
      if (assignee && assignee.trim()) {
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
            'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
            [projectId, id, '指派', '負責人', oldAssigneeName, assignee]
          )
        }
      } else if (oldAssignee[0]?.name) {
        // Removed assignee
        await query(
          'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
          [projectId, id, '指派', '負責人', oldAssigneeName, '(未指派)']
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 })
  }
}
