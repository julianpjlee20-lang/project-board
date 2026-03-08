import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'
import { validateData, createSubtaskSchema, updateSubtaskSchema } from '@/lib/validations'
import {
  autoTransitionOnDateSet,
  autoTransitionOnAllSubtasksCompleted,
  autoTransitionOnSubtaskUncompleted,
} from '@/lib/auto-transition'

// GET /api/cards/[id]/subtasks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const subtasks = await query(
      `SELECT s.*, p.name as assignee_name
       FROM subtasks s
       LEFT JOIN profiles p ON s.assignee_id = p.id
       WHERE s.card_id = $1
       ORDER BY s.position`,
      [id]
    )

    return NextResponse.json(subtasks)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch subtasks' }, { status: 500 })
  }
}

// POST /api/cards/[id]/subtasks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { id: cardId } = await params
    const body = await request.json()

    // Zod 驗證
    const validation = validateData(createSubtaskSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { title, due_date, assignee_id } = validation.data

    // Get max position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM subtasks WHERE card_id = $1',
      [cardId]
    )
    const position = posResult[0]?.pos || 0

    const result = await query(
      `INSERT INTO subtasks (card_id, title, position, due_date, assignee_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [cardId, title, position, due_date ?? null, assignee_id ?? null]
    )

    // 查詢 assignee_name
    const subtask = result[0]
    if (subtask.assignee_id) {
      const profile = await query('SELECT name FROM profiles WHERE id = $1', [subtask.assignee_id])
      subtask.assignee_name = profile[0]?.name || null
    } else {
      subtask.assignee_name = null
    }

    return NextResponse.json(subtask)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 })
  }
}

// PUT /api/cards/[id]/subtasks
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { id: cardId } = await params
    const body = await request.json()

    // Zod 驗證
    const validation = validateData(updateSubtaskSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { subtask_id, title, is_completed, due_date, assignee_id } = validation.data

    // 構建動態 SET 子句：只更新有提供的欄位
    const setClauses: string[] = []
    const values: (string | number | boolean | null | undefined)[] = []
    let paramIndex = 1

    if (title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`)
      values.push(title)
    }

    if (is_completed !== undefined) {
      setClauses.push(`is_completed = $${paramIndex++}`)
      values.push(is_completed)
    }

    if (due_date !== undefined) {
      // 空字串轉 null（清除值）
      setClauses.push(`due_date = $${paramIndex++}`)
      values.push(due_date === '' ? null : due_date)
    }

    if (assignee_id !== undefined) {
      // 空字串轉 null（清除值）
      setClauses.push(`assignee_id = $${paramIndex++}`)
      values.push(assignee_id === '' ? null : assignee_id)
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: '至少需提供一個更新欄位' }, { status: 400 })
    }

    // 加入 WHERE 條件的參數
    values.push(subtask_id, cardId)
    const whereClause = `WHERE id = $${paramIndex++} AND card_id = $${paramIndex++}`

    const result = await query(
      `UPDATE subtasks SET ${setClauses.join(', ')} ${whereClause} RETURNING *`,
      values
    )

    if (result.length === 0) {
      return NextResponse.json({ error: '子任務不存在' }, { status: 404 })
    }

    // 附加 assignee_name
    const subtask = result[0]
    if (subtask.assignee_id) {
      const profile = await query('SELECT name FROM profiles WHERE id = $1', [subtask.assignee_id])
      subtask.assignee_name = profile[0]?.name || null
    } else {
      subtask.assignee_name = null
    }

    // 滾動截止日：當子任務完成狀態或截止日改變時，更新母卡截止日
    if (is_completed !== undefined || due_date !== undefined) {
      const cardResult = await query(
        'SELECT rolling_due_date FROM cards WHERE id = $1',
        [cardId]
      )

      if (cardResult[0]?.rolling_due_date) {
        await query(`
          UPDATE cards SET due_date = (
            SELECT MIN(due_date) FROM subtasks
            WHERE card_id = $1 AND is_completed = false AND due_date IS NOT NULL
          ) WHERE id = $1
        `, [cardId])
      }
    }

    // 自動狀態轉換
    let autoTransition = null
    if (is_completed === true) {
      // 規則 2：所有子任務完成 → 移到已完成欄
      const result = await autoTransitionOnAllSubtasksCompleted(cardId)
      if (result.moved) autoTransition = result
    } else if (is_completed === false) {
      // 規則 3：取消完成 → 從已完成回到進行中
      const result = await autoTransitionOnSubtaskUncompleted(cardId)
      if (result.moved) autoTransition = result
    }
    if (due_date !== undefined && due_date && due_date !== '') {
      // 規則 1：子任務設定日期 → 待辦移到進行中
      const result = await autoTransitionOnDateSet(cardId)
      if (result.moved) autoTransition = result
    }

    return NextResponse.json({ ...subtask, auto_transition: autoTransition })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update subtask' }, { status: 500 })
  }
}

// DELETE /api/cards/[id]/subtasks
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { id: cardId } = await params
    const { searchParams } = new URL(request.url)
    const subtask_id = searchParams.get('subtask_id')

    if (!subtask_id) {
      return NextResponse.json({ error: 'Subtask ID required' }, { status: 400 })
    }

    await query('DELETE FROM subtasks WHERE id = $1 AND card_id = $2', [subtask_id, cardId])

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete subtask' }, { status: 500 })
  }
}
