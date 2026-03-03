/**
 * 忘記密碼 API
 * POST - 發送密碼重設 Email
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { validateData, forgotPasswordSchema } from '@/lib/validations'
import { generateResetToken, hashToken } from '@/lib/token'
import { sendPasswordResetEmail } from '@/lib/email'

// POST /api/auth/forgot-password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = validateData(forgotPasswordSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: '輸入驗證失敗', details: validation.errors }, { status: 400 })
    }

    const { email } = validation.data

    // 永遠回 200，防 email 枚舉
    const successMessage = '若此 Email 已註冊，重設連結已發送至您的信箱'

    // 查找帳號（必須是 credentials 帳號，有 password_hash）
    const rows = await query(
      'SELECT id, password_hash FROM profiles WHERE email = $1 AND is_active = true',
      [email]
    )

    if (rows.length === 0 || !rows[0].password_hash) {
      return NextResponse.json({ message: successMessage })
    }

    const profileId = rows[0].id

    // Rate limit：5 分鐘內最多 3 次
    const recentTokens = await query(
      `SELECT COUNT(*)::int as count FROM password_reset_tokens
       WHERE profile_id = $1 AND created_at > NOW() - INTERVAL '5 minutes'`,
      [profileId]
    )
    if (recentTokens[0].count >= 3) {
      return NextResponse.json(
        { error: '請求過於頻繁，請 5 分鐘後再試' },
        { status: 429 }
      )
    }

    // 產生 token
    const rawToken = generateResetToken()
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 60 分鐘

    // 清理舊的未使用 token
    await query(
      'DELETE FROM password_reset_tokens WHERE profile_id = $1 AND used_at IS NULL',
      [profileId]
    )

    // 存入新 token
    await query(
      `INSERT INTO password_reset_tokens (profile_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [profileId, tokenHash, expiresAt.toISOString()]
    )

    // 發送 email
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`
    await sendPasswordResetEmail({ to: email, resetUrl })

    return NextResponse.json({ message: successMessage })
  } catch (error) {
    console.error('[POST /api/auth/forgot-password] Error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
