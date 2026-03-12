import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'
import { z } from 'zod'
import { validateData } from '@/lib/validations'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// MCP server 發送的 body 格式（與主專案 createCardSchema 不同）
const createPhaseCardSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  assignee: z.string().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式需為 YYYY-MM-DD').optional(),
})

// GET /api/phases/[phase_id]/cards
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ phase_id: string }> }
) {
  try {
    await requireAuth()

    const { phase_id } = await params

    if (!UUID_REGEX.test(phase_id)) {
      return NextResponse.json({ error: 'phase_id 格式無效' }, { status: 400 })
    }

    // 確認 phase 存在
    const phaseResult = await query('SELECT id FROM phases WHERE id = $1', [phase_id])
    if (phaseResult.length === 0) {
      return NextResponse.json({ error: '階段不存在' }, { status: 404 })
    }

    const baseFields = `c.id, c.title, c.description, c.progress, c.priority,
      c.due_date, c.start_date, c.planned_completion_date, c.actual_completion_date,
      c.position, c.column_id, c.phase_id, c.created_at, c.updated_at,
      col.name as column_name`

    const subqueries = `,
      COALESCE(
        (SELECT json_agg(json_build_object('id', p.id, 'name', p.name))
         FROM card_assignees ca JOIN profiles p ON ca.user_id = p.id
         WHERE ca.card_id = c.id), '[]') as assignees,
      COALESCE(
        (SELECT json_agg(json_build_object('id', s.id, 'title', s.title, 'is_completed', s.is_completed, 'position', s.position) ORDER BY s.position)
         FROM subtasks s WHERE s.card_id = c.id), '[]') as subtasks,
      COALESCE(
        (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
         FROM tags t JOIN card_tags ct ON t.id = ct.tag_id WHERE ct.card_id = c.id), '[]') as tags`

    // 嘗試帶 card_number 查詢，失敗則 fallback
    const buildSql = (withCardNumber: boolean) => {
      const cardNumberField = withCardNumber ? ', c.card_number' : ', NULL as card_number'
      return `SELECT ${baseFields}${cardNumberField}${subqueries}
        FROM cards c
        JOIN columns col ON c.column_id = col.id
        WHERE c.phase_id = $1
        ORDER BY c.position
        LIMIT 500`
    }

    let cards
    try {
      cards = await query(buildSql(true), [phase_id])
    } catch {
      cards = await query(buildSql(false), [phase_id])
    }

    // 為 MCP server 補上 status / assignee 映射欄位
    const enrichedCards = cards.map((c: Record<string, unknown>) => ({
      ...c,
      status: c.column_name,
      assignee: Array.isArray(c.assignees) && (c.assignees as Array<{ name: string }>).length > 0
        ? (c.assignees as Array<{ name: string }>)[0].name
        : null,
    }))
    return NextResponse.json({ total: enrichedCards.length, cards: enrichedCards })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/phases/[phase_id]/cards error:', error)
    return NextResponse.json({
      error: '取得卡片列表失敗',
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

// POST /api/phases/[phase_id]/cards
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ phase_id: string }> }
) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { phase_id } = await params

    if (!UUID_REGEX.test(phase_id)) {
      return NextResponse.json({ error: 'phase_id 格式無效' }, { status: 400 })
    }

    const body = await request.json()

    // Zod 驗證（使用 MCP 的欄位格式）
    const validation = validateData(createPhaseCardSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors,
      }, { status: 400 })
    }

    const { title, description, due_date, status, assignee } = validation.data

    // 確認 phase 存在並取得 project_id
    const phaseResult = await query(
      'SELECT id, project_id FROM phases WHERE id = $1',
      [phase_id]
    )
    if (phaseResult.length === 0) {
      return NextResponse.json({ error: '階段不存在' }, { status: 404 })
    }
    const projectId = phaseResult[0].project_id

    // 取得該專案的所有 columns（依 position 排序）
    const colResult = await query(
      'SELECT id, position FROM columns WHERE project_id = $1 ORDER BY position',
      [projectId]
    )
    if (colResult.length === 0) {
      return NextResponse.json({ error: '專案中沒有可用的欄位' }, { status: 400 })
    }

    // 根據 status 映射到對應的 column（position 0=todo, 1=in_progress, 2=done）
    let columnId = colResult[0].id // 預設使用第一個 column
    if (status) {
      const statusPositionMap: Record<string, number> = {
        todo: 0,
        in_progress: 1,
        done: 2,
      }
      const targetPosition = statusPositionMap[status]
      const matchedCol = colResult.find((col: { id: string; position: number }) => col.position === targetPosition)
      if (matchedCol) {
        columnId = matchedCol.id
      }
    }

    // 原子取號：鎖定 project row，position 和 card_number 都在鎖保護下計算
    const result = await query(`
      WITH lock_project AS (
        SELECT id FROM projects WHERE id = $1 FOR UPDATE
      ),
      next_number AS (
        SELECT COALESCE(MAX(c.card_number), 0) + 1 AS next_num
        FROM cards c
        JOIN columns col ON c.column_id = col.id
        WHERE col.project_id = $1
      ),
      next_position AS (
        SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
        FROM cards
        WHERE column_id = $2
      )
      INSERT INTO cards (column_id, title, description, due_date, position, card_number, phase_id)
      SELECT $2, $3, $4, $5, next_pos, next_num, $6
      FROM next_number, next_position
      RETURNING *
    `, [projectId, columnId, title, description ?? null, due_date ?? null, phase_id])

    const newCard = result[0]

    // 處理 assignee：寫入 card_assignees
    if (assignee) {
      // 先嘗試 UUID 匹配，再嘗試姓名匹配
      let profileResult = await query(
        'SELECT id FROM profiles WHERE id = $1',
        [assignee]
      ).catch(() => []) // UUID 格式不合法時不報錯

      if (profileResult.length === 0) {
        profileResult = await query(
          'SELECT id FROM profiles WHERE name = $1',
          [assignee]
        )
      }

      if (profileResult.length > 0) {
        await query(
          'INSERT INTO card_assignees (card_id, user_id) VALUES ($1, $2)',
          [newCard.id, profileResult[0].id]
        )
      }
    }

    return NextResponse.json(newCard, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/phases/[phase_id]/cards error:', error)
    return NextResponse.json({
      error: '建立卡片失敗',
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
