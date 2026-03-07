import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { query } from '@/lib/db'
import { generateFromTemplateSchema, validateData } from '@/lib/validations'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'

/**
 * 計算子任務截止日，處理超過月底的情況
 * @param year  西元年
 * @param month 月份 (1-based)
 * @param dayOfMonth 日（模板設定的 day_of_month）
 */
function calcDueDate(year: number, month: number, dayOfMonth: number): string {
  const lastDay = new Date(year, month, 0).getDate() // month 是 1-based，取該月最後一天
  const day = Math.min(dayOfMonth, lastDay)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// POST /api/templates/[id]/generate
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient()

  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { id: templateId } = await params
    const body = await request.json()

    // Zod 驗證
    const validation = validateData(generateFromTemplateSchema, body)
    if (!validation.success) {
      client.release()
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { start_month, count } = validation.data

    // 查詢模板 + 子任務
    const templates = await query(
      `SELECT ct.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ts.id, 'title', ts.title, 'position', ts.position,
              'day_of_month', ts.day_of_month, 'assignee_id', ts.assignee_id
            ) ORDER BY ts.position
          ) FILTER (WHERE ts.id IS NOT NULL), '[]'
        ) as subtasks
      FROM card_templates ct
      LEFT JOIN template_subtasks ts ON ts.template_id = ct.id
      WHERE ct.id = $1
      GROUP BY ct.id`,
      [templateId]
    )

    if (templates.length === 0) {
      client.release()
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }

    const template = templates[0]
    const projectId = template.project_id
    const subtaskTemplates = typeof template.subtasks === 'string'
      ? JSON.parse(template.subtasks)
      : template.subtasks

    // 確認 target_column 有效，無效則 fallback 到專案第一個欄位
    let targetColumnId = template.target_column_id
    if (targetColumnId) {
      const colCheck = await query(
        'SELECT id FROM columns WHERE id = $1 AND project_id = $2',
        [targetColumnId, projectId]
      )
      if (colCheck.length === 0) {
        targetColumnId = null
      }
    }
    if (!targetColumnId) {
      const firstCol = await query(
        'SELECT id FROM columns WHERE project_id = $1 ORDER BY position LIMIT 1',
        [projectId]
      )
      if (firstCol.length === 0) {
        client.release()
        return NextResponse.json({ error: '專案沒有任何欄位' }, { status: 400 })
      }
      targetColumnId = firstCol[0].id
    }

    // 開始 transaction
    await client.query('BEGIN')

    try {
      // 取得 target_column 目前最大 position
      const posResult = await client.query(
        'SELECT COALESCE(MAX(position), -1) AS max_pos FROM cards WHERE column_id = $1',
        [targetColumnId]
      )
      let currentPosition = (posResult.rows[0]?.max_pos ?? -1) + 1

      const [startYear, startMonth] = start_month.split('-').map(Number)
      const createdCards = []

      for (let i = 0; i < count; i++) {
        // 計算當次月份
        const date = new Date(startYear, startMonth - 1 + i)
        const yyyy = date.getFullYear().toString()
        const mm = (date.getMonth() + 1).toString().padStart(2, '0')

        // 替換標題
        const title = template.title_pattern
          .replace('{{YYYY}}', yyyy)
          .replace('{{MM}}', mm)

        // 原子取號 + 建立卡片
        const cardResult = await client.query(`
          WITH lock_project AS (
            SELECT id FROM projects WHERE id = $1 FOR UPDATE
          ),
          next_number AS (
            SELECT COALESCE(MAX(c.card_number), 0) + 1 AS next_num
            FROM cards c
            JOIN columns col ON c.column_id = col.id
            WHERE col.project_id = $1
          )
          INSERT INTO cards (column_id, title, description, priority, position, card_number, rolling_due_date)
          SELECT $2, $3, $4, $5, $6, next_num, $7
          FROM next_number
          RETURNING *
        `, [
          projectId,
          targetColumnId,
          title,
          template.description || '',
          template.priority || 'medium',
          currentPosition,
          template.rolling_due_date ?? false
        ])

        const card = cardResult.rows[0]
        currentPosition++

        // 建立子任務
        const yearNum = date.getFullYear()
        const monthNum = date.getMonth() + 1
        const subtaskDueDates: string[] = []

        for (const st of subtaskTemplates) {
          const dueDate = st.day_of_month != null
            ? calcDueDate(yearNum, monthNum, st.day_of_month)
            : null

          if (dueDate) {
            subtaskDueDates.push(dueDate)
          }

          await client.query(
            `INSERT INTO subtasks (card_id, title, position, due_date, assignee_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [card.id, st.title, st.position, dueDate, st.assignee_id ?? null]
          )
        }

        // 設定母卡 due_date（根據 rolling_due_date 決定取 MIN 或 MAX）
        if (subtaskDueDates.length > 0) {
          const sorted = subtaskDueDates.sort()
          const cardDueDate = template.rolling_due_date
            ? sorted[0]                      // MIN - 最早的子任務截止日
            : sorted[sorted.length - 1]      // MAX - 最晚的子任務截止日

          await client.query(
            'UPDATE cards SET due_date = $2 WHERE id = $1',
            [card.id, cardDueDate]
          )
          card.due_date = cardDueDate
        }

        createdCards.push(card)
      }

      await client.query('COMMIT')

      return NextResponse.json({
        cards: createdCards,
        count: createdCards.length
      })
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/templates/[id]/generate error:', error)
    return NextResponse.json({
      error: '從模板產生卡片失敗',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  } finally {
    client.release()
  }
}
