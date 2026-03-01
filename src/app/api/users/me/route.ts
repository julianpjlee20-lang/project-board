/**
 * 使用者個人資料 API
 * GET  - 取得當前使用者的完整個人資料
 * PUT  - 更新當前使用者的個人資料（名稱、頭像）
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { updateProfileSchema, validateData } from '@/lib/validations'

// GET /api/users/me
export async function GET() {
  try {
    const user = await requireAuth()

    const rows = await query(
      `SELECT id, name, email, avatar_url, role, discord_user_id, created_at
       FROM profiles
       WHERE id = $1`,
      [user.id]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: '找不到使用者資料' },
        { status: 404 }
      )
    }

    const profile = rows[0]

    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatar_url: profile.avatar_url,
      role: profile.role,
      provider: user.provider ?? 'credentials',
      discord_connected: !!profile.discord_user_id,
      created_at: profile.created_at,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[GET /api/users/me] Error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

// PUT /api/users/me
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json()

    // Zod 驗證
    const validation = validateData(updateProfileSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: '輸入驗證失敗', details: validation.errors },
        { status: 400 }
      )
    }

    const { name, avatar_url } = validation.data

    // 建立動態 UPDATE 語句，只更新有提供的欄位
    const setClauses: string[] = []
    const values: (string | null)[] = []
    let paramIndex = 1

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex}`)
      values.push(name)
      paramIndex++
    }

    if (avatar_url !== undefined) {
      setClauses.push(`avatar_url = $${paramIndex}`)
      values.push(avatar_url || null)
      paramIndex++
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: '未提供任何更新欄位' },
        { status: 400 }
      )
    }

    setClauses.push('updated_at = NOW()')
    values.push(user.id)

    const updated = await query(
      `UPDATE profiles
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, email, avatar_url, role, discord_user_id, created_at`,
      values
    )

    if (updated.length === 0) {
      return NextResponse.json(
        { error: '找不到使用者資料' },
        { status: 404 }
      )
    }

    const profile = updated[0]

    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatar_url: profile.avatar_url,
      role: profile.role,
      provider: user.provider ?? 'credentials',
      discord_connected: !!profile.discord_user_id,
      created_at: profile.created_at,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[PUT /api/users/me] Error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
