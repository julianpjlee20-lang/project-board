/**
 * AI 專用：專案總覽端點
 * 一次取得所有專案 + 欄位 + 卡片摘要
 * 適合 AI 工具快速理解全局狀態
 *
 * 效能優化：使用跨專案批次查詢（5 queries），
 * 不論專案數量多少都維持固定查詢次數（原本 N×4）
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'

interface ProjectRow {
  id: string
  name: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

interface ColumnRow {
  project_id: string
  id: string
  name: string
  color: string
  position: number
  card_count: number
}

interface StatsRow {
  project_id: string
  total_cards: number
  completed_cards: number
  overdue_cards: number
  avg_progress: number
}

interface PhaseRow {
  project_id: string
  id: string
  name: string
  color: string
  position: number
  total_cards: number
  completed_cards: number
}

interface RecentCardRow {
  project_id: string
  id: string
  card_number: number | null
  title: string
  progress: number
  priority: string
  due_date: string | null
  updated_at: string
  column_name: string
  assignees: Array<{ id: string; name: string }> | null
  rn: number
}

/**
 * GET /api/ai/overview — 取得所有專案的完整總覽
 *
 * 回傳格式：
 * {
 *   total_projects: number,
 *   projects: [{
 *     id, name, description, status, start_date, end_date, created_at,
 *     columns: [{ id, name, color, position, card_count }],
 *     stats: { total_cards, completed_cards, overdue_cards, avg_progress },
 *     phases: [{ id, name, color, position, total_cards, completed_cards }],
 *     recent_cards: [{ id, card_number, title, progress, priority, due_date, updated_at, column_name, assignees }]
 *   }]
 * }
 */
export async function GET() {
  try {
    await requireAuth()

    // === 批次查詢：不論 N 個專案都只執行 5 個查詢 ===
    const [projects, allColumns, allStats, allPhases, allRecentCards] = await Promise.all([
      // 1. 所有專案
      query('SELECT * FROM projects ORDER BY created_at DESC') as Promise<ProjectRow[]>,

      // 2. 所有專案的欄位 + 每欄卡片數（GROUP BY project_id）
      query(`
        SELECT col.project_id, col.id, col.name, col.color, col.position,
               COUNT(c.id)::int as card_count
        FROM columns col
        LEFT JOIN cards c ON c.column_id = col.id
        GROUP BY col.project_id, col.id, col.name, col.color, col.position
        ORDER BY col.project_id, col.position
      `) as Promise<ColumnRow[]>,

      // 3. 所有專案的卡片統計（GROUP BY project_id）
      query(`
        SELECT
          col.project_id,
          COUNT(c.id)::int as total_cards,
          COUNT(CASE WHEN c.actual_completion_date IS NOT NULL THEN 1 END)::int as completed_cards,
          COUNT(CASE WHEN c.due_date < NOW() AND c.actual_completion_date IS NULL THEN 1 END)::int as overdue_cards,
          COALESCE(ROUND(AVG(c.progress)), 0)::int as avg_progress
        FROM cards c
        JOIN columns col ON c.column_id = col.id
        GROUP BY col.project_id
      `) as Promise<StatsRow[]>,

      // 4. 所有專案的階段 + 進度（GROUP BY project_id）
      query(`
        SELECT ph.project_id, ph.id, ph.name, ph.color, ph.position,
               COUNT(c.id)::int as total_cards,
               COUNT(CASE WHEN c.actual_completion_date IS NOT NULL THEN 1 END)::int as completed_cards
        FROM phases ph
        LEFT JOIN cards c ON c.phase_id = ph.id
        GROUP BY ph.project_id, ph.id, ph.name, ph.color, ph.position
        ORDER BY ph.project_id, ph.position
      `) as Promise<PhaseRow[]>,

      // 5. 所有專案最近更新的卡片（每專案前 10 張，用 ROW_NUMBER）
      query(`
        SELECT sub.* FROM (
          SELECT col.project_id,
                 c.id, c.card_number, c.title, c.progress, c.priority,
                 c.due_date, c.updated_at, col.name as column_name,
                 COALESCE(
                   (SELECT json_agg(json_build_object('id', p.id, 'name', p.name))
                    FROM card_assignees ca JOIN profiles p ON ca.user_id = p.id
                    WHERE ca.card_id = c.id), '[]') as assignees,
                 ROW_NUMBER() OVER (PARTITION BY col.project_id ORDER BY c.updated_at DESC) as rn
          FROM cards c
          JOIN columns col ON c.column_id = col.id
        ) sub
        WHERE sub.rn <= 10
        ORDER BY sub.project_id, sub.rn
      `) as Promise<RecentCardRow[]>,
    ])

    // === JS 端重組資料結構 ===

    // 用 Map 做 O(1) lookup，避免重複遍歷
    const columnsByProject = groupBy(allColumns, 'project_id')
    const statsByProject = new Map(allStats.map(s => [s.project_id, s]))
    const phasesByProject = groupBy(allPhases, 'project_id')
    const recentCardsByProject = groupBy(allRecentCards, 'project_id')

    const defaultStats = { total_cards: 0, completed_cards: 0, overdue_cards: 0, avg_progress: 0 }

    const result = projects.map((project) => {
      const columns = (columnsByProject.get(project.id) || []).map(
        ({ project_id: _pid, ...col }) => col
      )
      const phases = (phasesByProject.get(project.id) || []).map(
        ({ project_id: _pid, ...ph }) => ph
      )
      const recentCards = (recentCardsByProject.get(project.id) || []).map(
        ({ project_id: _pid, rn: _rn, ...card }) => card
      )

      const stats = statsByProject.get(project.id) || defaultStats
      const { project_id: _pid, ...statsWithoutProjectId } = stats as StatsRow & { project_id?: string }

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        start_date: project.start_date,
        end_date: project.end_date,
        created_at: project.created_at,
        columns,
        stats: statsWithoutProjectId,
        phases,
        recent_cards: recentCards,
      }
    })

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

/** 將陣列依指定 key 分組為 Map */
function groupBy<T>(arr: T[], key: keyof T): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of arr) {
    const k = String(item[key])
    const group = map.get(k)
    if (group) {
      group.push(item)
    } else {
      map.set(k, [item])
    }
  }
  return map
}
