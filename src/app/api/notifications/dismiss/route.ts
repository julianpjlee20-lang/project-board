/**
 * 通知忽略 API
 * POST   - 忽略指定卡片的通知
 * DELETE - 恢復已忽略的通知
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'
import { dismissNotificationSchema, validateData } from '@/lib/validations'

// POST /api/notifications/dismiss
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const body = await request.json()

    // Zod 驗證
    const validation = validateData(dismissNotificationSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: '輸入驗證失敗', details: validation.errors },
        { status: 400 }
      )
    }

    const { card_id, dismiss_type } = validation.data

    await query(
      `INSERT INTO notification_dismissed (user_id, card_id, dismiss_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, card_id, dismiss_type) DO NOTHING`,
      [user.id, card_id, dismiss_type]
    )

    return NextResponse.json({ success: true, message: '通知已忽略' })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Notifications Dismiss] POST error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

// DELETE /api/notifications/dismiss
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const body = await request.json()

    // Zod 驗證
    const validation = validateData(dismissNotificationSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: '輸入驗證失敗', details: validation.errors },
        { status: 400 }
      )
    }

    const { card_id, dismiss_type } = validation.data

    await query(
      `DELETE FROM notification_dismissed
       WHERE user_id = $1 AND card_id = $2 AND dismiss_type = $3`,
      [user.id, card_id, dismiss_type]
    )

    return NextResponse.json({ success: true, message: '通知已恢復' })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Notifications Dismiss] DELETE error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
