/**
 * 通知中心 API
 * GET - 取得到期提醒、逾期卡片、近期變更、專案摘要
 */

import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAuth, AuthError } from "@/lib/auth"

// GET /api/notifications/center
export async function GET() {
  try {
    const user = await requireAuth()

    // 平行執行 5 個查詢
    const [dueSoonRows, overdueRows, recentChangesRows, projectSummaryRows, dismissedRows] =
      await Promise.all([
        // 1. 7 日內到期的卡片
        query(`
          SELECT c.id, c.title, c.due_date, c.priority, c.progress,
            p.id AS project_id, p.name AS project_name,
            col.id AS column_id, col.name AS column_name,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object('id', ca_user.id, 'name', ca_user.name))
              FILTER (WHERE ca_user.id IS NOT NULL),
              '[]'
            ) AS assignees
          FROM cards c
          JOIN columns col ON c.column_id = col.id
          JOIN projects p ON col.project_id = p.id
          LEFT JOIN card_assignees ca ON c.id = ca.card_id
          LEFT JOIN profiles ca_user ON ca.user_id = ca_user.id
          WHERE c.due_date IS NOT NULL
            AND c.due_date >= NOW()
            AND c.due_date <= NOW() + INTERVAL '7 days'
            AND c.actual_completion_date IS NULL
            AND col.position < (SELECT MAX(col2.position) FROM columns col2 WHERE col2.project_id = p.id)
          GROUP BY c.id, c.title, c.due_date, c.priority, c.progress, p.id, p.name, col.id, col.name
          ORDER BY c.due_date ASC
          LIMIT 50
        `),

        // 2. 已逾期的卡片
        query(`
          SELECT c.id, c.title, c.due_date, c.priority, c.progress,
            EXTRACT(DAY FROM NOW() - c.due_date)::int AS days_overdue,
            p.id AS project_id, p.name AS project_name,
            col.id AS column_id, col.name AS column_name,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object('id', ca_user.id, 'name', ca_user.name))
              FILTER (WHERE ca_user.id IS NOT NULL),
              '[]'
            ) AS assignees
          FROM cards c
          JOIN columns col ON c.column_id = col.id
          JOIN projects p ON col.project_id = p.id
          LEFT JOIN card_assignees ca ON c.id = ca.card_id
          LEFT JOIN profiles ca_user ON ca.user_id = ca_user.id
          WHERE c.due_date IS NOT NULL
            AND c.due_date < NOW()
            AND c.actual_completion_date IS NULL
            AND col.position < (SELECT MAX(col2.position) FROM columns col2 WHERE col2.project_id = p.id)
          GROUP BY c.id, c.title, c.due_date, c.priority, c.progress, p.id, p.name, col.id, col.name
          ORDER BY c.due_date ASC
          LIMIT 50
        `),

        // 3. 近 7 天的活動記錄
        query(`
          SELECT al.id, al.action, al.target, al.old_value, al.new_value, al.created_at,
            al.card_id, prof.name AS user_name, c.title AS card_title,
            p.id AS project_id, p.name AS project_name
          FROM activity_logs al
          LEFT JOIN profiles prof ON al.user_id = prof.id
          LEFT JOIN cards c ON al.card_id = c.id
          JOIN projects p ON al.project_id = p.id
          WHERE al.created_at >= NOW() - INTERVAL '7 days'
          ORDER BY al.created_at DESC
          LIMIT 100
        `),

        // 4. 各專案進度摘要
        query(`
          SELECT
            p.id, p.name,
            COUNT(c.id)::int AS total_cards,
            COUNT(c.id) FILTER (
              WHERE col.position = max_pos.max_position
                 OR c.actual_completion_date IS NOT NULL
            )::int AS completed_cards,
            COUNT(c.id) FILTER (
              WHERE c.due_date IS NOT NULL
                AND c.due_date < NOW()
                AND c.actual_completion_date IS NULL
                AND col.position < max_pos.max_position
            )::int AS overdue_count,
            COUNT(c.id) FILTER (
              WHERE c.due_date IS NOT NULL
                AND c.due_date >= NOW()
                AND c.due_date <= NOW() + INTERVAL '7 days'
                AND c.actual_completion_date IS NULL
                AND col.position < max_pos.max_position
            )::int AS due_soon_count
          FROM projects p
          LEFT JOIN columns col ON col.project_id = p.id
          LEFT JOIN cards c ON c.column_id = col.id
          LEFT JOIN LATERAL (
            SELECT MAX(col2.position) AS max_position
            FROM columns col2
            WHERE col2.project_id = p.id
          ) max_pos ON true
          GROUP BY p.id, p.name, max_pos.max_position
          ORDER BY p.name ASC
        `),

        // 5. 當前使用者已忽略的通知
        query(
          `SELECT card_id, dismiss_type FROM notification_dismissed WHERE user_id = $1`,
          [user.id]
        ),
      ])

    // 應用層計算 completion_rate
    const project_summary = projectSummaryRows.map((row) => ({
      id: row.id,
      name: row.name,
      total_cards: row.total_cards,
      completed_cards: row.completed_cards,
      overdue_count: row.overdue_count,
      due_soon_count: row.due_soon_count,
      completion_rate:
        row.total_cards > 0
          ? Math.round((row.completed_cards / row.total_cards) * 100)
          : 0,
    }))

    return NextResponse.json({
      due_soon: dueSoonRows,
      overdue: overdueRows,
      recent_changes: recentChangesRows,
      project_summary,
      dismissed: dismissedRows,
      counts: {
        due_soon: dueSoonRows.length,
        overdue: overdueRows.length,
        recent_changes: recentChangesRows.length,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Notifications Center] GET error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
