/**
 * Admin 系統統計 API
 * GET - 取得系統總覽統計數據
 */

import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin, AuthError } from "@/lib/auth"

// GET /api/admin/stats
export async function GET() {
  try {
    const _user = await requireAdmin()

    // 使用單一查詢取得所有統計，效率最佳
    const rows = await query(`
      SELECT
        (SELECT COUNT(*) FROM profiles) AS total_users,
        (SELECT COUNT(*) FROM profiles WHERE is_active = true) AS active_users,
        (SELECT COUNT(*) FROM profiles WHERE is_active = false) AS disabled_users,
        (SELECT COUNT(*) FROM projects) AS total_projects,
        (SELECT COUNT(*) FROM cards) AS total_cards,
        (SELECT COUNT(*) FROM profiles WHERE created_at >= date_trunc('month', NOW())) AS users_this_month,
        (SELECT COUNT(*) FROM profiles WHERE password_hash IS NOT NULL) AS credentials_users,
        (SELECT COUNT(*) FROM profiles WHERE discord_user_id IS NOT NULL) AS discord_users
    `)

    const stats = rows[0]

    return NextResponse.json({
      total_users: Number(stats.total_users),
      active_users: Number(stats.active_users),
      disabled_users: Number(stats.disabled_users),
      total_projects: Number(stats.total_projects),
      total_cards: Number(stats.total_cards),
      users_this_month: Number(stats.users_this_month),
      credentials_users: Number(stats.credentials_users),
      discord_users: Number(stats.discord_users),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Admin Stats] GET error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
