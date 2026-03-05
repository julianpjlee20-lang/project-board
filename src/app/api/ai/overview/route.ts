/**
 * AI 專用：專案總覽端點
 * 一次取得所有專案 + 欄位 + 卡片摘要
 * 適合 AI 工具快速理解全局狀態
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'

/**
 * GET /api/ai/overview — 取得所有專案的完整總覽
 *
 * 回傳格式：
 * {
 *   projects: [{
 *     id, name, status, start_date, end_date,
 *     columns: [{ id, name, color, card_count }],
 *     stats: { total_cards, completed_cards, overdue_cards, avg_progress },
 *     phases: [{ id, name, color, total_cards, completed_cards }]
 *   }]
 * }
 */
export async function GET() {
  try {
    await requireAuth()

    // 取得所有專案
    const projects = await query(
      'SELECT * FROM projects ORDER BY created_at DESC'
    )

    const result = await Promise.all(projects.map(async (project) => {
      // 並行查詢：欄位摘要、卡片統計、階段
      const [columns, stats, phases, recentCards] = await Promise.all([
        // 欄位 + 每欄卡片數
        query(`
          SELECT col.id, col.name, col.color, col.position,
                 COUNT(c.id)::int as card_count
          FROM columns col
          LEFT JOIN cards c ON c.column_id = col.id
          WHERE col.project_id = $1
          GROUP BY col.id, col.name, col.color, col.position
          ORDER BY col.position
        `, [project.id]),

        // 卡片統計
        query(`
          SELECT
            COUNT(c.id)::int as total_cards,
            COUNT(CASE WHEN c.actual_completion_date IS NOT NULL THEN 1 END)::int as completed_cards,
            COUNT(CASE WHEN c.due_date < NOW() AND c.actual_completion_date IS NULL THEN 1 END)::int as overdue_cards,
            COALESCE(ROUND(AVG(c.progress)), 0)::int as avg_progress
          FROM cards c
          JOIN columns col ON c.column_id = col.id
          WHERE col.project_id = $1
        `, [project.id]),

        // 階段 + 進度
        query(`
          SELECT ph.id, ph.name, ph.color, ph.position,
                 COUNT(c.id)::int as total_cards,
                 COUNT(CASE WHEN c.actual_completion_date IS NOT NULL THEN 1 END)::int as completed_cards
          FROM phases ph
          LEFT JOIN cards c ON c.phase_id = ph.id
          WHERE ph.project_id = $1
          GROUP BY ph.id, ph.name, ph.color, ph.position
          ORDER BY ph.position
        `, [project.id]),

        // 最近更新的卡片（前 10 張）— card_number 可能尚未 migrate，加 fallback
        query(`
          SELECT c.id, c.card_number, c.title, c.progress, c.priority,
                 c.due_date, c.updated_at, col.name as column_name,
                 COALESCE(
                   (SELECT json_agg(json_build_object('id', p.id, 'name', p.name))
                    FROM card_assignees ca JOIN profiles p ON ca.user_id = p.id
                    WHERE ca.card_id = c.id), '[]') as assignees
          FROM cards c
          JOIN columns col ON c.column_id = col.id
          WHERE col.project_id = $1
          ORDER BY c.updated_at DESC
          LIMIT 10
        `, [project.id]).catch(() =>
          query(`
            SELECT c.id, NULL as card_number, c.title, c.progress, c.priority,
                   c.due_date, c.updated_at, col.name as column_name,
                   COALESCE(
                     (SELECT json_agg(json_build_object('id', p.id, 'name', p.name))
                      FROM card_assignees ca JOIN profiles p ON ca.user_id = p.id
                      WHERE ca.card_id = c.id), '[]') as assignees
            FROM cards c
            JOIN columns col ON c.column_id = col.id
            WHERE col.project_id = $1
            ORDER BY c.updated_at DESC
            LIMIT 10
          `, [project.id])
        ),
      ])

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        start_date: project.start_date,
        end_date: project.end_date,
        created_at: project.created_at,
        columns,
        stats: stats[0] || { total_cards: 0, completed_cards: 0, overdue_cards: 0, avg_progress: 0 },
        phases,
        recent_cards: recentCards,
      }
    }))

    return NextResponse.json({
      total_projects: result.length,
      projects: result,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/ai/overview error:', error)
    return NextResponse.json({
      error: '取得專案總覽失敗',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
