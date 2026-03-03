/**
 * 重設密碼 API
 * GET  - 驗證 token 是否有效
 * POST - 設定新密碼
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { validateData, resetPasswordSchema } from '@/lib/validations'
import { hashToken } from '@/lib/token'
import bcrypt from 'bcryptjs'

// 遮蔽 email（只露出前 1 個字元 + @ 後網域）
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const masked = local.length > 1
    ? local[0] + '***'
    : '***'
  return `${masked}@${domain}`
}

// GET /api/auth/reset-password?token=...
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ valid: false, error: '缺少 token 參數' })
    }

    const tokenHash = hashToken(token)
    const rows = await query(
      `SELECT prt.expires_at, prt.used_at, p.email
       FROM password_reset_tokens prt
       JOIN profiles p ON p.id = prt.profile_id
       WHERE prt.token_hash = $1`,
      [tokenHash]
    )

    if (rows.length === 0) {
      return NextResponse.json({ valid: false, error: '重設連結無效' })
    }

    const { expires_at, used_at, email } = rows[0]

    if (used_at) {
      return NextResponse.json({ valid: false, error: '此連結已被使用' })
    }

    if (new Date(expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: '重設連結已過期' })
    }

    return NextResponse.json({ valid: true, email: maskEmail(email) })
  } catch (error) {
    console.error('[GET /api/auth/reset-password] Error:', error)
    return NextResponse.json({ valid: false, error: '伺服器錯誤' })
  }
}

// POST /api/auth/reset-password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = validateData(resetPasswordSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: '輸入驗證失敗', details: validation.errors },
        { status: 400 }
      )
    }

    const { token, new_password } = validation.data
    const tokenHash = hashToken(token)

    // 查詢 token
    const rows = await query(
      `SELECT prt.id, prt.profile_id, prt.expires_at, prt.used_at
       FROM password_reset_tokens prt
       WHERE prt.token_hash = $1`,
      [tokenHash]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: '重設連結無效' }, { status: 400 })
    }

    const { id: tokenId, profile_id, expires_at, used_at } = rows[0]

    if (used_at) {
      return NextResponse.json({ error: '此連結已被使用' }, { status: 400 })
    }

    if (new Date(expires_at) < new Date()) {
      return NextResponse.json({ error: '重設連結已過期' }, { status: 400 })
    }

    // Hash 新密碼
    const newHash = await bcrypt.hash(new_password, 12)

    // 更新密碼 + 標記 token 已使用
    await query(
      'UPDATE profiles SET password_hash = $1, force_password_change = false, updated_at = NOW() WHERE id = $2',
      [newHash, profile_id]
    )
    await query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [tokenId]
    )

    return NextResponse.json({ message: '密碼已重設，請重新登入' })
  } catch (error) {
    console.error('[POST /api/auth/reset-password] Error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
