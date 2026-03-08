import { NextRequest, NextResponse, after } from 'next/server'
import { query } from '@/lib/db'
import { updateCardSchema, validateData } from '@/lib/validations'
import { sendNotification } from '@/lib/notifications'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'
import { autoTransitionOnDateSet } from '@/lib/auto-transition'

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

    // Get assignees, subtasks, tags in parallel (independent queries)
    const [assignees, subtasks, tags] = await Promise.all([
      query(`
        SELECT p.id, p.name
        FROM profiles p
        JOIN card_assignees ca ON p.id = ca.user_id
        WHERE ca.card_id = $1
      `, [id]),
      query(`
        SELECT s.id, s.title, s.is_completed, s.position, s.due_date, s.assignee_id, p.name as assignee_name
        FROM subtasks s
        LEFT JOIN profiles p ON s.assignee_id = p.id
        WHERE s.card_id = $1
        ORDER BY s.position
      `, [id]),
      query(`
        SELECT t.id, t.name, t.color FROM tags t
        JOIN card_tags ct ON t.id = ct.tag_id
        WHERE ct.card_id = $1
      `, [id]),
    ])
    
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
  let step = 'init'
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { id } = await params
    const body = await request.json()

    // Zod 驗證
    step = 'validation'
    const validation = validateData(updateCardSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { title, description, assignee_id, progress, priority, phase_id } = validation.data
    let { start_date, due_date, planned_completion_date, actual_completion_date } = validation.data

    // Fix: Convert empty string to null for date fields
    if (start_date === '') start_date = null
    if (due_date === '') due_date = null
    if (planned_completion_date === '') planned_completion_date = null
    if (actual_completion_date === '') actual_completion_date = null

    // Get old card data for activity log
    step = 'fetch-old-card'
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
    step = 'update-card'
    await query(
      `UPDATE cards SET title = $1, description = $2, due_date = $3, progress = COALESCE($4, progress), priority = COALESCE($5, priority), phase_id = CASE WHEN $6::boolean THEN $7::uuid ELSE phase_id END, start_date = CASE WHEN $9::boolean THEN $10::timestamptz ELSE start_date END, planned_completion_date = CASE WHEN $11::boolean THEN $12::date ELSE planned_completion_date END, actual_completion_date = CASE WHEN $13::boolean THEN $14::date ELSE actual_completion_date END, updated_at = NOW() WHERE id = $8`,
      [title, description, due_date, progress, priority, phase_id !== undefined, phase_id ?? null, id, start_date !== undefined, start_date ?? null, planned_completion_date !== undefined, planned_completion_date ?? null, actual_completion_date !== undefined, actual_completion_date ?? null]
    )

    // Collect non-critical tasks (activity logs + notifications) for after()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterTasks: (() => Promise<any>)[] = []

    // Activity logs — collect into afterTasks
    step = 'activity-logs'
    if (oldTitle !== title) {
      afterTasks.push(() => query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '標題', oldTitle, title]
      ))
      afterTasks.push(() => sendNotification({
        cardTitle: title ?? oldTitle ?? '',
        action: '更新標題',
        projectName,
      }))
    }

    if (oldDescription !== description) {
      afterTasks.push(() => query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '描述', oldDescription ? '有描述' : '無', description ? '有描述' : '無']
      ))
    }

    if (progress !== undefined && oldProgress !== progress) {
      afterTasks.push(() => query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '進度', `${oldProgress}%`, `${progress}%`]
      ))
    }

    if (String(oldDueDate) !== String(due_date)) {
      const oldDate = oldDueDate ? String(oldDueDate).split('T')[0] : '(未設定)'
      const newDate = due_date ? String(due_date).split('T')[0] : '(未設定)'
      afterTasks.push(() => query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '截止日', oldDate, newDate]
      ))
    }

    if (priority !== undefined && oldPriority !== priority) {
      const priorityLabel: Record<string, string> = { low: '低', medium: '中', high: '高' }
      const oldLabel = priorityLabel[oldPriority] || oldPriority || '(未設定)'
      const newLabel = priorityLabel[priority] || priority
      afterTasks.push(() => query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '優先度', oldLabel, newLabel]
      ))
    }

    // Phase changed — need phase names, so resolve before pushing
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
      afterTasks.push(() => query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '階段', oldPhaseName, newPhaseName]
      ))
    }

    if (start_date !== undefined && String(oldStartDate) !== String(start_date)) {
      const oldDate = oldStartDate ? String(oldStartDate).split('T')[0] : '(未設定)'
      const newDate = start_date ? String(start_date).split('T')[0] : '(未設定)'
      afterTasks.push(() => query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '開始日期', oldDate, newDate]
      ))
    }

    if (planned_completion_date !== undefined && String(oldPlannedCompletionDate) !== String(planned_completion_date)) {
      const oldDate = oldPlannedCompletionDate ? String(oldPlannedCompletionDate).split('T')[0] : '(未設定)'
      const newDate = planned_completion_date ? String(planned_completion_date).split('T')[0] : '(未設定)'
      afterTasks.push(() => query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '預計完成日', oldDate, newDate]
      ))
    }

    if (actual_completion_date !== undefined && String(oldActualCompletionDate) !== String(actual_completion_date)) {
      const oldDate = oldActualCompletionDate ? String(oldActualCompletionDate).split('T')[0] : '(未設定)'
      const newDate = actual_completion_date ? String(actual_completion_date).split('T')[0] : '(未設定)'
      afterTasks.push(() => query(
        'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, id, '修改', '實際完成日', oldDate, newDate]
      ))
    }

    // Handle assignee (by user ID) — business logic stays blocking, logs/notifications deferred
    step = 'handle-assignee'
    if (assignee_id !== undefined) {
      const oldAssignee = await query(
        'SELECT p.name FROM profiles p JOIN card_assignees ca ON p.id = ca.user_id WHERE ca.card_id = $1',
        [id]
      )
      const oldAssigneeName = oldAssignee[0]?.name || '(未指派)'

      await query('DELETE FROM card_assignees WHERE card_id = $1', [id])

      if (assignee_id && assignee_id !== '') {
        const targetUser = await query('SELECT id, name FROM profiles WHERE id = $1', [assignee_id])

        if (targetUser.length > 0) {
          const newAssigneeName = targetUser[0].name || '(未命名)'

          await query(
            'INSERT INTO card_assignees (card_id, user_id) VALUES ($1, $2)',
            [id, targetUser[0].id]
          )

          afterTasks.push(() => query(
            'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
            [projectId, id, '指派', '負責人', oldAssigneeName, newAssigneeName]
          ))

          afterTasks.push(() => sendNotification({
            cardTitle: title ?? oldTitle ?? '',
            action: `指派給 ${newAssigneeName}`,
            projectName,
          }))
        }
      } else {
        if (oldAssigneeName !== '(未指派)') {
          afterTasks.push(() => query(
            'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
            [projectId, id, '取消指派', '負責人', oldAssigneeName, '(未指派)']
          ))
        }
      }
    }


    // 自動狀態轉換：日期從無到有 → 待辦移到進行中
    step = 'auto-transition'
    let autoTransition = null
    const dateWasSet =
      (start_date && !oldStartDate) ||
      (due_date && !oldDueDate)
    if (dateWasSet) {
      autoTransition = await autoTransitionOnDateSet(id)
      if (autoTransition.moved) autoTransition = { moved: true, newColumnId: autoTransition.newColumnId, newColumnName: autoTransition.newColumnName }
      else autoTransition = null
    }

    // Execute activity logs and notifications after response is sent
    if (afterTasks.length > 0) {
      after(async () => {
        await Promise.allSettled(afterTasks.map(fn => fn()))
      })
    }

    return NextResponse.json({ success: true, auto_transition: autoTransition })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const errMsg = error instanceof Error ? error.message : String(error)
    const errStack = error instanceof Error ? error.stack : undefined
    console.error('[PUT /api/cards] Error:', errMsg)
    if (errStack) console.error(errStack)
    return NextResponse.json({
      error: 'Failed to update card',
      detail: errMsg,
      step
    }, { status: 500 })
  }
}

// DELETE /api/cards/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { id } = await params

    // Delete card (CASCADE will delete related assignees, comments, subtasks, etc.)
    await query('DELETE FROM cards WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 })
  }
}
