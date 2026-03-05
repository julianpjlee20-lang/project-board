import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

/**
 * GET /api/calendar — 取得所有專案中有日期的卡片（跨專案行事曆用）
 * 不需認證（與 GET /api/projects/[id]/columns 一致）
 */
export async function GET() {
  try {
    const cards = await query(`
      SELECT c.id, c.card_number, c.title, c.progress, c.priority,
             c.due_date, c.start_date, c.planned_completion_date, c.actual_completion_date,
             c.column_id, col.name as column_name, col.color as column_color,
             p.id as project_id, p.name as project_name,
             COALESCE(
               (SELECT json_agg(json_build_object('id', pr.id, 'name', pr.name))
                FROM card_assignees ca JOIN profiles pr ON ca.user_id = pr.id
                WHERE ca.card_id = c.id), '[]') as assignees,
             COALESCE(
               (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
                FROM tags t JOIN card_tags ct ON t.id = ct.tag_id WHERE ct.card_id = c.id), '[]') as tags
      FROM cards c
      JOIN columns col ON c.column_id = col.id
      JOIN projects p ON col.project_id = p.id
      WHERE c.due_date IS NOT NULL
         OR c.planned_completion_date IS NOT NULL
         OR c.actual_completion_date IS NOT NULL
      ORDER BY COALESCE(c.due_date, c.planned_completion_date, c.actual_completion_date)
    `)

    // 收集所有出現的專案（用於前端篩選）
    const projectMap = new Map<string, { id: string; name: string }>()
    for (const card of cards) {
      if (!projectMap.has(card.project_id)) {
        projectMap.set(card.project_id, { id: card.project_id, name: card.project_name })
      }
    }

    return NextResponse.json({
      cards,
      projects: Array.from(projectMap.values()),
    })
  } catch (error) {
    console.error('GET /api/calendar error:', error)
    return NextResponse.json({
      error: '取得行事曆資料失敗',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
