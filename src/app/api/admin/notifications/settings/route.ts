/**
 * Admin 通知設定 API
 * GET  - 讀取通知設定 + boss 用戶詳情
 * PUT  - 更新通知設定
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin, AuthError } from "@/lib/auth"
import { validateData, notificationSettingsSchema } from "@/lib/validations"

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001"

// GET /api/admin/notifications/settings
export async function GET() {
  try {
    await requireAdmin()

    // 查詢通知設定（只有一行）
    const rows = await query(
      `SELECT boss_user_ids, daily_digest_enabled, digest_include_upcoming,
              digest_include_overdue, digest_include_yesterday_changes,
              digest_include_project_stats, digest_send_hour
       FROM notification_settings WHERE id = $1`,
      [SETTINGS_ID]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: "通知設定不存在" }, { status: 404 })
    }

    const settings = rows[0]

    // 如果 boss_user_ids 非空，查詢用戶詳情
    let boss_users: { id: string; name: string; email: string }[] = []
    if (settings.boss_user_ids && settings.boss_user_ids.length > 0) {
      const placeholders = settings.boss_user_ids.map((_: string, i: number) => `$${i + 1}`).join(", ")
      boss_users = await query(
        `SELECT id, name, email FROM profiles WHERE id IN (${placeholders})`,
        settings.boss_user_ids
      )
    }

    return NextResponse.json({ settings, boss_users })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Admin Notifications Settings] GET error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// PUT /api/admin/notifications/settings
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const validation = validateData(notificationSettingsSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: "驗證失敗", details: validation.errors }, { status: 400 })
    }

    const data = validation.data

    // 動態建構 UPDATE SET 子句（只更新提供的欄位）
    const setClauses: string[] = []
    const params: (string | number | boolean | string[])[] = []
    let paramIndex = 1

    if (data.boss_user_ids !== undefined) {
      setClauses.push(`boss_user_ids = $${paramIndex}`)
      params.push(data.boss_user_ids)
      paramIndex++
    }
    if (data.daily_digest_enabled !== undefined) {
      setClauses.push(`daily_digest_enabled = $${paramIndex}`)
      params.push(data.daily_digest_enabled)
      paramIndex++
    }
    if (data.digest_include_upcoming !== undefined) {
      setClauses.push(`digest_include_upcoming = $${paramIndex}`)
      params.push(data.digest_include_upcoming)
      paramIndex++
    }
    if (data.digest_include_overdue !== undefined) {
      setClauses.push(`digest_include_overdue = $${paramIndex}`)
      params.push(data.digest_include_overdue)
      paramIndex++
    }
    if (data.digest_include_yesterday_changes !== undefined) {
      setClauses.push(`digest_include_yesterday_changes = $${paramIndex}`)
      params.push(data.digest_include_yesterday_changes)
      paramIndex++
    }
    if (data.digest_include_project_stats !== undefined) {
      setClauses.push(`digest_include_project_stats = $${paramIndex}`)
      params.push(data.digest_include_project_stats)
      paramIndex++
    }
    if (data.digest_send_hour !== undefined) {
      setClauses.push(`digest_send_hour = $${paramIndex}`)
      params.push(data.digest_send_hour)
      paramIndex++
    }

    // 沒有任何欄位要更新
    if (setClauses.length === 0) {
      return NextResponse.json({ error: "未提供任何欄位" }, { status: 400 })
    }

    // 加上 updated_at
    setClauses.push("updated_at = NOW()")

    const updateQuery = `
      UPDATE notification_settings
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING boss_user_ids, daily_digest_enabled, digest_include_upcoming,
                digest_include_overdue, digest_include_yesterday_changes,
                digest_include_project_stats, digest_send_hour
    `
    params.push(SETTINGS_ID)

    const rows = await query(updateQuery, params as (string | number | boolean | null | undefined)[])

    if (rows.length === 0) {
      return NextResponse.json({ error: "通知設定不存在" }, { status: 404 })
    }

    return NextResponse.json({ settings: rows[0] })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Admin Notifications Settings] PUT error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
