import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'
import { validateData, moveCardSchema } from '@/lib/validations'

// POST /api/cards/move
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const body = await request.json()

    // Zod 驗證
    const validation = validateData(moveCardSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { card_id, source_column_id, dest_column_id, source_index, dest_index } = validation.data

    // Get the card
    const cards = await query('SELECT * FROM cards WHERE id = $1', [card_id])
    if (cards.length === 0) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Update the card's column and position
    await query(
      'UPDATE cards SET column_id = $1, position = $2, updated_at = NOW() WHERE id = $3',
      [dest_column_id, dest_index, card_id]
    )

    // Reorder other cards in source column
    if (source_column_id !== dest_column_id) {
      const sourceCards = await query(
        'SELECT id FROM cards WHERE column_id = $1 AND id != $2 ORDER BY position',
        [source_column_id, card_id]
      )

      if (sourceCards.length > 0) {
        const ids = sourceCards.map((c: { id: number }) => c.id)
        const positions = sourceCards.map((_: unknown, i: number) => i)
        await query(
          `UPDATE cards SET position = batch.pos
           FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS pos) AS batch
           WHERE cards.id = batch.id`,
          [ids, positions]
        )
      }
    }

    // Reorder cards in destination column
    const destCards = await query(
      'SELECT id FROM cards WHERE column_id = $1 ORDER BY position',
      [dest_column_id]
    )

    if (destCards.length > 0) {
      const ids = destCards.map((c: { id: number }) => c.id)
      const positions = destCards.map((_: unknown, i: number) => i)
      await query(
        `UPDATE cards SET position = batch.pos
         FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS pos) AS batch
         WHERE cards.id = batch.id`,
        [ids, positions]
      )
    }

    // === 重複卡片自動產生 ===
    let recurring_card_created = null

    const card = cards[0]
    // 不對已封存的卡片觸發重複
    if (card.recurrence_rule && !card.is_archived) {
      const projectResult = await query(
        'SELECT project_id FROM columns WHERE id = $1',
        [dest_column_id]
      )
      if (projectResult.length > 0) {
        const projectId = projectResult[0].project_id
        const maxPosResult = await query(
          'SELECT MAX(position) as max_pos FROM columns WHERE project_id = $1',
          [projectId]
        )
        const destColResult = await query(
          'SELECT position FROM columns WHERE id = $1',
          [dest_column_id]
        )

        // 只有移動到最後一個欄位（完成欄）才觸發
        if (destColResult[0]?.position === maxPosResult[0]?.max_pos) {
          recurring_card_created = await createRecurringCard(
            card, card_id, projectId, source_column_id
          )
        }
      }
    }

    return NextResponse.json({ success: true, recurring_card_created })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to move card' }, { status: 500 })
  }
}

/** 安全的月份加法，處理月底溢位 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  const targetMonth = result.getMonth() + months
  result.setMonth(targetMonth)
  // 處理溢位：如 1/31 + 1 月 → 應為 2/28 而非 3/3
  if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(0) // 回到上個月最後一天
  }
  return result
}

/** 計算下一個 due_date */
function calcNextDueDate(
  oldDueDate: string,
  rule: { frequency: string; day_of_month?: number; day_of_week?: number; month_of_year?: number }
): string {
  const oldDue = new Date(oldDueDate + 'T00:00:00')

  switch (rule.frequency) {
    case 'daily':
      oldDue.setDate(oldDue.getDate() + 1)
      return oldDue.toISOString().split('T')[0]
    case 'weekly':
      oldDue.setDate(oldDue.getDate() + 7)
      return oldDue.toISOString().split('T')[0]
    case 'monthly': {
      const next = addMonths(oldDue, 1)
      // 如果有指定 day_of_month，嘗試使用
      if (rule.day_of_month) {
        const year = next.getFullYear()
        const month = next.getMonth()
        const lastDay = new Date(year, month + 1, 0).getDate()
        next.setDate(Math.min(rule.day_of_month, lastDay))
      }
      return next.toISOString().split('T')[0]
    }
    case 'yearly': {
      const next = new Date(oldDue)
      next.setFullYear(next.getFullYear() + 1)
      // 處理 2/29 → 非閏年
      if (next.getMonth() !== oldDue.getMonth()) {
        next.setDate(0)
      }
      return next.toISOString().split('T')[0]
    }
    default:
      oldDue.setMonth(oldDue.getMonth() + 1)
      return oldDue.toISOString().split('T')[0]
  }
}

/** 在 transaction 中建立重複卡片 */
async function createRecurringCard(
  card: Record<string, unknown>,
  cardId: string,
  projectId: string,
  sourceColumnId: string
): Promise<{ id: string; title: string; column_id: string } | null> {
  const rule = card.recurrence_rule as {
    frequency: string
    day_of_week?: number
    day_of_month?: number
    month_of_year?: number
    auto_suffix?: boolean
  }

  // 決定目標欄位：original_column_id > 專案第一個欄位（避免放回完成欄）
  let targetColumnId = card.original_column_id as string | null
  if (!targetColumnId) {
    const firstCol = await query(
      'SELECT id FROM columns WHERE project_id = $1 ORDER BY position LIMIT 1',
      [projectId]
    )
    targetColumnId = firstCol.length > 0 ? firstCol[0].id : sourceColumnId
  } else {
    // 確認欄位仍存在
    const colExists = await query('SELECT id FROM columns WHERE id = $1', [targetColumnId])
    if (colExists.length === 0) {
      const firstCol = await query(
        'SELECT id FROM columns WHERE project_id = $1 ORDER BY position LIMIT 1',
        [projectId]
      )
      targetColumnId = firstCol.length > 0 ? firstCol[0].id : sourceColumnId
    }
  }

  // 計算標題後綴（只移除已知格式的舊後綴）
  const now = new Date()
  let suffix = ''
  if (rule.auto_suffix !== false) {
    switch (rule.frequency) {
      case 'daily':
      case 'weekly': {
        const nextDate = rule.frequency === 'daily'
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
        suffix = ` - ${String(nextDate.getMonth() + 1).padStart(2, '0')}/${String(nextDate.getDate()).padStart(2, '0')}`
        break
      }
      case 'monthly': {
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        suffix = ` - ${nextMonth.getFullYear()}/${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
        break
      }
      case 'yearly':
        suffix = ` - ${now.getFullYear() + 1}`
        break
    }
  }

  // 只移除本系統產生的後綴格式
  const title = card.title as string
  const baseTitle = suffix
    ? title
        .replace(/ - \d{2}\/\d{2}$/, '')   // daily/weekly: - MM/DD
        .replace(/ - \d{4}\/\d{2}$/, '')   // monthly: - YYYY/MM
        .replace(/ - \d{4}$/, '')           // yearly: - YYYY
    : title  // auto_suffix=false 時不修改標題
  const newTitle = baseTitle + suffix

  // 計算新 due_date
  let newDueDate: string | null = null
  if (card.due_date) {
    newDueDate = calcNextDueDate(card.due_date as string, rule)
  }

  // 在 transaction 中執行所有寫入
  const client = await getClient()
  try {
    await client.query('BEGIN')

    // card_number 使用 FOR UPDATE 避免 race condition
    const maxCardNum = await client.query(
      'SELECT COALESCE(MAX(card_number), 0) + 1 as next_num FROM cards FOR UPDATE'
    )
    const nextNum = maxCardNum.rows[0].next_num

    const maxCardPos = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM cards WHERE column_id = $1',
      [targetColumnId]
    )
    const nextPos = maxCardPos.rows[0].next_pos

    // 建立新卡片
    const newCardResult = await client.query(
      `INSERT INTO cards (column_id, title, description, priority, phase_id,
       due_date, rolling_due_date, recurrence_rule, recurrence_source_id,
       original_column_id, position, card_number, progress, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, 0, NOW(), NOW())
       RETURNING id, title, column_id`,
      [
        targetColumnId,
        newTitle,
        card.description,
        card.priority,
        card.phase_id,
        newDueDate,
        card.rolling_due_date,
        JSON.stringify(card.recurrence_rule),
        cardId,  // recurrence_source_id = 原卡片
        targetColumnId,  // original_column_id
        nextPos,
        nextNum
      ]
    )
    const newCard = newCardResult.rows[0]

    // 批次複製子任務
    const subtasks = await client.query(
      'SELECT title, position, due_date, assignee_id FROM subtasks WHERE card_id = $1 ORDER BY position',
      [cardId]
    )
    if (subtasks.rows.length > 0) {
      const stTitles: string[] = []
      const stPositions: number[] = []
      const stDueDates: (string | null)[] = []
      const stAssignees: (string | null)[] = []

      for (const st of subtasks.rows) {
        stTitles.push(st.title)
        stPositions.push(st.position)
        stAssignees.push(st.assignee_id)
        if (st.due_date) {
          stDueDates.push(calcNextDueDate(st.due_date, rule))
        } else {
          stDueDates.push(null)
        }
      }

      await client.query(
        `INSERT INTO subtasks (card_id, title, position, is_completed, due_date, assignee_id, created_at)
         SELECT $1, t.title, t.pos, false, t.due::date, t.assignee::uuid, NOW()
         FROM unnest($2::text[], $3::int[], $4::text[], $5::text[])
           AS t(title, pos, due, assignee)`,
        [newCard.id, stTitles, stPositions, stDueDates, stAssignees]
      )
    }

    // 批次複製指派人
    const assignees = await client.query(
      'SELECT user_id FROM card_assignees WHERE card_id = $1',
      [cardId]
    )
    if (assignees.rows.length > 0) {
      const userIds = assignees.rows.map((a: { user_id: string }) => a.user_id)
      await client.query(
        `INSERT INTO card_assignees (card_id, user_id)
         SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
        [newCard.id, userIds]
      )
    }

    // 批次複製標籤
    const tags = await client.query(
      'SELECT tag_id FROM card_tags WHERE card_id = $1',
      [cardId]
    )
    if (tags.rows.length > 0) {
      const tagIds = tags.rows.map((t: { tag_id: string }) => t.tag_id)
      await client.query(
        `INSERT INTO card_tags (card_id, tag_id)
         SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
        [newCard.id, tagIds]
      )
    }

    await client.query('COMMIT')

    return {
      id: newCard.id,
      title: newCard.title,
      column_id: newCard.column_id
    }
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[recurring card] transaction failed:', error)
    return null
  } finally {
    client.release()
  }
}
