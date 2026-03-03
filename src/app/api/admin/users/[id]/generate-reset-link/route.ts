/**
 * 管理員產生密碼重設連結 API
 * POST - 產生重設連結供管理員複製給使用者
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAdmin, AuthError } from '@/lib/auth'
import { generateResetToken, hashToken } from '@/lib/token'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id: targetId } = await params

    // 不允許為自己產生（管理員用設定頁改密碼）
    if (admin.id === targetId) {
      return NextResponse.json(
        { error: '無法為自己產生重設連結，請使用「更改密碼」功能' },
        { status: 403 }
      )
    }

    // 確認目標使用者存在且為 credentials 帳號
    const targetRows = await query(
      'SELECT id, password_hash FROM profiles WHERE id = $1',
      [targetId]
    )

    if (targetRows.length === 0) {
      return NextResponse.json({ error: '使用者不存在' }, { status: 404 })
    }

    if (!targetRows[0].password_hash) {
      return NextResponse.json(
        { error: '該使用者為 OAuth 帳號，無法重設密碼' },
        { status: 400 }
      )
    }

    // 產生 token
    const rawToken = generateResetToken()
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 60 分鐘

    // 清理舊的未使用 token
    await query(
      'DELETE FROM password_reset_tokens WHERE profile_id = $1 AND used_at IS NULL',
      [targetId]
    )

    // 存入新 token
    await query(
      `INSERT INTO password_reset_tokens (profile_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [targetId, tokenHash, expiresAt.toISOString()]
    )

    // 組合連結
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`

    return NextResponse.json({
      message: '重設連結已產生',
      resetUrl,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Admin Users/:id/generate-reset-link] POST error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
