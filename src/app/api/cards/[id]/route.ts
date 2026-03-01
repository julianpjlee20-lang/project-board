import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { updateCardSchema, validateData } from '@/lib/validations'
import { sendNotification } from '@/lib/notifications'

// GET /api/cards/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Get card
    const cards = await query('SELECT * FROM cards WHERE id = $1', [id])
    
    if (cards.length === 0) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }
    
    const card = cards[0]
    
    // Get assignees
    const assignees = await query(`
      SELECT p.id, p.name 
      FROM profiles p 
      JOIN card_assignees ca ON p.id = ca.user_id 
      WHERE ca.card_id = $1
    `, [id])
    
    // Get subtasks
    const subtasks = await query(`
      SELECT * FROM subtasks WHERE card_id = $1 ORDER BY position
    `, [id])
    
    // Get tags
    const tags = await query(`
      SELECT t.* FROM tags t
      JOIN card_tags ct ON t.id = ct.tag_id
      WHERE ct.card_id = $1
    `, [id])
    
    return NextResponse.json({
      ...card,
      assignees,
      subtasks,
      tags
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch card' }, { status: 500 })
  }
}

// PUT /api/cards/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Zod 驗證
    console.log('[PUT /api/cards] Request body:', JSON.stringify(body, null, 2))
    const validation = validateData(updateCardSchema, body)
    if (!validation.success) {
      console.error('[PUT /api/cards] Validation failed:', validation.errors)
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { title, description, assignee, progress, priority, phase_id } = validation.data
    let { start_date, due_date, planned_completion_date, actual_completion_date } = validation.data

    // Fix: Convert empty string to null for date fields
    if (start_date === '') {
      start_date = null
    }
    if (due_date === '') {
      due_date = null
    }
    if (planned_completion_date === '') {
      planned_completion_date = null
    }
    if (actual_completion_date === '') {
      actual_completion_date = null
    }

    // Get old card data for activity log
    const oldCard = await query('SELECT * FROM cards WHERE id = $1', [id])
    const oldTitle = oldCard[0]?.title
    const oldDescription = oldCard[0]?.description
    const oldDueDate = oldCard[0]?.due_date
    const oldProgress = oldCard[0]?.progress || 0
    const oldPriority = oldCard[0]?.priority
    const oldPhaseId = oldCard[0]?.phase_id
    const oldStartDate = oldCard[0]?.start_date
    const oldPlannedCompletionDate = oldCard[0]?.planned_completion_date
    const oldActualCompletionDate = oldCard[0]?.actual_completion_date

    // Get project_id
    const column = oldCard[0]?.column_id ?
      await query('SELECT project_id FROM columns WHERE id = $1', [oldCard[0].column_id]) : null
    const projectId = column?.[0]?.project_id || null

    // Get project name for notifications
    const project = projectId ?
      await query('SELECT name FROM projects WHERE id = $1', [projectId]) : null
    const projectName = project?.[0]?.name || 'Project'

    // Update card
    await query(
      `UPDATE cards SET title = $1, description = $2, due_date = $3, progress = COALESCE($4, progress), priority = COALESCE($5, priority), phase_id = CASE WHEN $6::boolean THEN $7::uuid ELSE phase_id END, start_date = CASE WHEN $9::boolean THEN $10::timestamptz ELSE start_date END, planned_completion_date = CASE WHEN $11::boolean THEN $12::date ELSE planned_completion_date END, actual_completion_date = CASE WHEN $13::boolean THEN $14::date ELSE actual_completion_date END, updated_at = NOW() WHERE id = $8`,
      [title, description, due_date, progress, priority, phase_id !== undefined, phase_id ?? null, id, start_date !== undefined, start_date ?? null, planned_completion_date !== undefined, planned_completion_date ?? null, actual_completion_date !== undefined, actual_completion_date ?? null]
    )

    // Activity log: Title changed
    if (oldTitle !== title) {
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '標題', oldTitle, title]
      )
      await sendNotification({
        cardTitle: title ?? oldTitle ?? '',
        action: '更新標題',
        projectName,
      })
    }

    // Activity log: Description changed
    if (oldDescription !== description) {
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '描述', oldDescription ? '有描述' : '無', description ? '有描述' : '無']
      )
    }

    // Activity log: Progress changed
    if (progress !== undefined && oldProgress !== progress) {
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '進度', `${oldProgress}%`, `${progress}%`]
      )
    }

    // Activity log: Due date changed
    if (String(oldDueDate) !== String(due_date)) {
      const oldDate = oldDueDate ? String(oldDueDate).split('T')[0] : '(未設定)'
      const newDate = due_date ? String(due_date).split('T')[0] : '(未設定)'
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '截止日', oldDate, newDate]
      )
    }

    // Activity log: Priority changed
    if (priority !== undefined && oldPriority !== priority) {
      const priorityLabel: Record<string, string> = { low: '低', medium: '中', high: '高' }
      const oldLabel = priorityLabel[oldPriority] || oldPriority || '(未設定)'
      const newLabel = priorityLabel[priority] || priority
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '優先度', oldLabel, newLabel]
      )
    }

    // Activity log: Phase changed
    if (phase_id !== undefined && oldPhaseId !== phase_id) {
      let oldPhaseName = '(未設定)'
      let newPhaseName = '(未設定)'
      if (oldPhaseId) {
        const oldPhase = await query('SELECT name FROM phases WHERE id = $1', [oldPhaseId])
        oldPhaseName = oldPhase[0]?.name || '(已刪除)'
      }
      if (phase_id) {
        const newPhase = await query('SELECT name FROM phases WHERE id = $1', [phase_id])
        newPhaseName = newPhase[0]?.name || '(未知階段)'
      }
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '階段', oldPhaseName, newPhaseName]
      )
    }

    // Activity log: Start date changed
    if (start_date !== undefined && String(oldStartDate) !== String(start_date)) {
      const oldDate = oldStartDate ? String(oldStartDate).split('T')[0] : '(未設定)'
      const newDate = start_date ? String(start_date).split('T')[0] : '(未設定)'
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '開始日期', oldDate, newDate]
      )
    }

    // Activity log: Planned completion date changed
    if (planned_completion_date !== undefined && String(oldPlannedCompletionDate) !== String(planned_completion_date)) {
      const oldDate = oldPlannedCompletionDate ? String(oldPlannedCompletionDate).split('T')[0] : '(未設定)'
      const newDate = planned_completion_date ? String(planned_completion_date).split('T')[0] : '(未設定)'
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '預計完成日', oldDate, newDate]
      )
    }

    // Activity log: Actual completion date changed
    if (actual_completion_date !== undefined && String(oldActualCompletionDate) !== String(actual_completion_date)) {
      const oldDate = oldActualCompletionDate ? String(oldActualCompletionDate).split('T')[0] : '(未設定)'
      const newDate = actual_completion_date ? String(actual_completion_date).split('T')[0] : '(未設定)'
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '實際完成日', oldDate, newDate]
      )
    }

    // Handle assignee
    if (assignee !== undefined) {
      const oldAssignee = await query(
        'SELECT p.name FROM profiles p JOIN card_assignees ca ON p.id = ca.user_id WHERE ca.card_id = $1',
        [id]
      )
      const oldAssigneeName = oldAssignee[0]?.name || '(未指派)'

      await query('DELETE FROM card_assignees WHERE card_id = $1', [id])
      
      if (assignee && assignee.trim()) {
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
          
          await query(
            'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
            [projectId, id, '指派', '負責人', oldAssigneeName, assignee]
          )
          
          await sendNotification({
            cardTitle: title ?? oldTitle ?? '',
            action: `指派給 ${assignee}`,
            projectName,
          })
        }
      }
    }


    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 })
  }
}

// DELETE /api/cards/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Delete card (CASCADE will delete related assignees, comments, subtasks, etc.)
    await query('DELETE FROM cards WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 })
  }
}
