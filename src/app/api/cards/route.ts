import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createCardSchema, validateData } from '@/lib/validations'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/cards?project_id=xxx[&column_id=xxx][&limit=100]
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const columnId = searchParams.get('column_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500)

    if (!projectId) {
      return NextResponse.json({ error: '缺少必要參數 project_id' }, { status: 400 })
    }
    if (!UUID_REGEX.test(projectId)) {
      return NextResponse.json({ error: 'project_id 格式無效' }, { status: 400 })
    }
    if (columnId && !UUID_REGEX.test(columnId)) {
      return NextResponse.json({ error: 'column_id 格式無效' }, { status: 400 })
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
      const select = withCardNumber
        ? `SELECT ${baseFields}, c.card_number${subqueries}`
        : `SELECT ${baseFields}, NULL as card_number${subqueries}`

      if (columnId) {
        return {
          sql: `${select}
            FROM cards c
            JOIN columns col ON c.column_id = col.id
            WHERE col.project_id = $1 AND c.column_id = $2
            ORDER BY c.position
            LIMIT $3`,
          params: [projectId, columnId, limit],
        }
      }
      return {
        sql: `${select}
          FROM cards c
          JOIN columns col ON c.column_id = col.id
          WHERE col.project_id = $1
          ORDER BY col.position, c.position
          LIMIT $2`,
        params: [projectId, limit],
      }
    }

    let cards
    try {
      const q = buildSql(true)
      cards = await query(q.sql, q.params)
    } catch {
      const q = buildSql(false)
      cards = await query(q.sql, q.params)
    }

    return NextResponse.json({ total: cards.length, cards })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/cards error:', error)
    return NextResponse.json({
      error: '取得卡片列表失敗',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// POST /api/cards
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const body = await request.json()

    // Zod 驗證
    const validation = validateData(createCardSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { column_id, title, phase_id } = validation.data

    // 取得 project_id（透過 column_id）
    const colResult = await query(
      'SELECT project_id FROM columns WHERE id = $1',
      [column_id]
    )
    if (colResult.length === 0) {
      return NextResponse.json({ error: '欄位不存在' }, { status: 400 })
    }
    const projectId = colResult[0].project_id

    // Get max position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM cards WHERE column_id = $1',
      [column_id]
    )
    const position = posResult[0]?.pos || 0

    // 原子取號：鎖定 project row 確保並發安全，再取 max card_number + 1
    const result = await query(`
      WITH lock_project AS (
        SELECT id FROM projects WHERE id = $1 FOR UPDATE
      ),
      next_number AS (
        SELECT COALESCE(MAX(c.card_number), 0) + 1 AS next_num
        FROM cards c
        JOIN columns col ON c.column_id = col.id
        WHERE col.project_id = $1
      )
      INSERT INTO cards (column_id, title, position, card_number, phase_id)
      SELECT $2, $3, $4, next_num, $5
      FROM next_number
      RETURNING *
    `, [projectId, column_id, title, position, phase_id ?? null])

    return NextResponse.json(result[0])
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 })
  }
}
