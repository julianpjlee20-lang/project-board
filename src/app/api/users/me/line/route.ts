/**
 * LINE 綁定管理
 * DELETE - 解除當前使用者的 LINE 綁定
 */

import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { query } from '@/lib/db'

export async function DELETE() {
  try {
    const user = await requireAuth()

    await query(
      `UPDATE profiles
       SET line_user_id = NULL,
           line_display_name = NULL,
           line_picture_url = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[DELETE /api/users/me/line] Error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
