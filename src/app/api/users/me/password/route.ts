/**
 * 使用者密碼更改 API
 * PUT - 更改當前使用者的密碼（僅限 credentials 帳號）
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { changePasswordSchema, validateData } from '@/lib/validations'
import bcrypt from 'bcryptjs'

// PUT /api/users/me/password
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

    // 檢查是否為 credentials 帳號
    if (user.provider !== 'credentials') {
      return NextResponse.json(
        { error: 'OAuth 帳號無法更改密碼' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Zod 驗證
    const validation = validateData(changePasswordSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: '輸入驗證失敗', details: validation.errors },
        { status: 400 }
      )
    }

    const { current_password, new_password } = validation.data

    // 從 DB 取得目前的 password_hash
    const rows = await query(
      'SELECT password_hash FROM profiles WHERE id = $1',
      [user.id]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: '找不到使用者資料' },
        { status: 404 }
      )
    }

    const { password_hash } = rows[0]

    if (!password_hash) {
      return NextResponse.json(
        { error: '此帳號未設定密碼，無法更改' },
        { status: 400 }
      )
    }

    // 驗證舊密碼
    const isValid = await bcrypt.compare(current_password, password_hash)
    if (!isValid) {
      return NextResponse.json(
        { error: '目前密碼不正確' },
        { status: 400 }
      )
    }

    // 產生新的 hash 並更新
    const newHash = await bcrypt.hash(new_password, 12)

    await query(
      'UPDATE profiles SET password_hash = $1, force_password_change = false, updated_at = NOW() WHERE id = $2',
      [newHash, user.id]
    )

    return NextResponse.json({ message: '密碼已更新' })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[PUT /api/users/me/password] Error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
