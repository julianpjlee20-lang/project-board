/**
 * 通知偏好 API
 * GET  - 取得當前使用者的通知偏好設定
 * PUT  - 更新當前使用者的通知偏好設定
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { notificationPreferencesSchema, validateData } from '@/lib/validations'

/** 預設通知偏好 */
const DEFAULT_PREFERENCES = {
  notify_assigned: true,
  notify_title_changed: false,
  notify_due_soon: true,
  notify_moved: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
}

// GET /api/notifications/preferences
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const rows = await query(
      `SELECT notify_assigned, notify_title_changed, notify_due_soon, notify_moved,
              quiet_hours_start, quiet_hours_end
       FROM notification_preferences
       WHERE user_id = $1`,
      [user.id]
    )

    // 無偏好記錄時回傳預設值
    const preferences = rows.length > 0 ? rows[0] : DEFAULT_PREFERENCES

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('GET /api/notifications/preferences error:', error)
    return NextResponse.json(
      { error: '取得通知偏好失敗' },
      { status: 500 }
    )
  }
}

// PUT /api/notifications/preferences
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const body = await request.json()

    // Zod 驗證
    const validation = validateData(notificationPreferencesSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: '輸入驗證失敗', details: validation.errors },
        { status: 400 }
      )
    }

    const {
      notify_assigned,
      notify_title_changed,
      notify_due_soon,
      notify_moved,
      quiet_hours_start,
      quiet_hours_end,
    } = validation.data

    // UPSERT：INSERT ON CONFLICT UPDATE
    await query(
      `INSERT INTO notification_preferences (user_id, notify_assigned, notify_title_changed, notify_due_soon, notify_moved, quiet_hours_start, quiet_hours_end)
       VALUES ($1, COALESCE($2, true), COALESCE($3, false), COALESCE($4, true), COALESCE($5, false), $6, $7)
       ON CONFLICT (user_id)
       DO UPDATE SET
         notify_assigned = COALESCE($2, notification_preferences.notify_assigned),
         notify_title_changed = COALESCE($3, notification_preferences.notify_title_changed),
         notify_due_soon = COALESCE($4, notification_preferences.notify_due_soon),
         notify_moved = COALESCE($5, notification_preferences.notify_moved),
         quiet_hours_start = COALESCE($6, notification_preferences.quiet_hours_start),
         quiet_hours_end = COALESCE($7, notification_preferences.quiet_hours_end),
         updated_at = NOW()`,
      [
        user.id,
        notify_assigned ?? null,
        notify_title_changed ?? null,
        notify_due_soon ?? null,
        notify_moved ?? null,
        quiet_hours_start ?? null,
        quiet_hours_end ?? null,
      ]
    )

    // 回傳更新後的偏好
    const updated = await query(
      `SELECT notify_assigned, notify_title_changed, notify_due_soon, notify_moved,
              quiet_hours_start, quiet_hours_end
       FROM notification_preferences
       WHERE user_id = $1`,
      [user.id]
    )

    return NextResponse.json(updated[0] || DEFAULT_PREFERENCES)
  } catch (error) {
    console.error('PUT /api/notifications/preferences error:', error)
    return NextResponse.json(
      { error: '更新通知偏好失敗' },
      { status: 500 }
    )
  }
}
