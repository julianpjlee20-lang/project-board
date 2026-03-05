/**
 * 通知計數 API（輕量 Badge 用）
 * GET - 回傳未完成的 overdue + due_soon 合計數量
 */

import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAuth, AuthError } from "@/lib/auth"

// GET /api/notifications/count
export async function GET() {
  try {
    const user = await requireAuth()
    const isAdmin = user.role === 'admin'

    // 非管理員只計算分配給自己的卡片
    const assigneeFilter = isAdmin
      ? ''
      : 'AND EXISTS (SELECT 1 FROM card_assignees ca_filter WHERE ca_filter.card_id = c.id AND ca_filter.user_id = $1)'

    const rows = await query(`
      SELECT
        COUNT(*) FILTER (
          WHERE c.due_date < NOW()
          AND NOT EXISTS (
            SELECT 1 FROM notification_dismissed nd
            WHERE nd.card_id = c.id AND nd.user_id = $1 AND nd.dismiss_type = 'overdue'
          )
        ) AS overdue_count,
        COUNT(*) FILTER (
          WHERE c.due_date >= NOW() AND c.due_date <= NOW() + INTERVAL '7 days'
          AND NOT EXISTS (
            SELECT 1 FROM notification_dismissed nd
            WHERE nd.card_id = c.id AND nd.user_id = $1 AND nd.dismiss_type = 'due_soon'
          )
        ) AS due_soon_count
      FROM cards c
      JOIN columns col ON c.column_id = col.id
      JOIN projects p ON col.project_id = p.id
      WHERE c.due_date IS NOT NULL
        AND c.actual_completion_date IS NULL
        AND col.position < (SELECT MAX(col2.position) FROM columns col2 WHERE col2.project_id = p.id)
        ${assigneeFilter}
    `, [user.id])

    const { overdue_count, due_soon_count } = rows[0]

    return NextResponse.json({
      count: Number(overdue_count) + Number(due_soon_count),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Notifications Count] GET error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
