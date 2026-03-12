import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/cards/archived?project_id=xxx[&search=keyword]
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const search = searchParams.get('search')

    if (!projectId) {
      return NextResponse.json({ error: '缺少必要參數 project_id' }, { status: 400 })
    }
    if (!UUID_REGEX.test(projectId)) {
      return NextResponse.json({ error: 'project_id 格式無效' }, { status: 400 })
    }

    const params: (string | number)[] = [projectId]
    let searchClause = ''

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`)
      searchClause = `AND c.title ILIKE $${params.length}`
    }

    const sql = `
      SELECT
        c.id, c.card_number, c.title, c.description, c.priority,
        c.actual_completion_date, c.archived_at, c.phase_id,
        col.name as column_name, col.color as column_color,
        ph.name as phase_name, ph.color as phase_color,
        COALESCE(
          (SELECT json_agg(json_build_object('id', p.id, 'name', p.name))
           FROM card_assignees ca JOIN profiles p ON ca.user_id = p.id
           WHERE ca.card_id = c.id), '[]') as assignees,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM tags t JOIN card_tags ct ON t.id = ct.tag_id
           WHERE ct.card_id = c.id), '[]') as tags
      FROM cards c
      JOIN columns col ON c.column_id = col.id
      LEFT JOIN phases ph ON c.phase_id = ph.id
      WHERE col.project_id = $1
        AND c.is_archived = true
        ${searchClause}
      ORDER BY c.archived_at DESC
    `

    const cards = await query(sql, params)

    return NextResponse.json({ total: cards.length, cards })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/cards/archived error:', error)
    return NextResponse.json({
      error: '取得封存卡片列表失敗',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
