/**
 * 管理員重設使用者密碼 API
 * POST - 重設指定使用者的密碼（僅限 credentials 帳號）
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin, AuthError } from "@/lib/auth"
import { adminResetPasswordSchema, validateData } from "@/lib/validations"
import bcrypt from "bcryptjs"

// POST /api/admin/users/[id]/reset-password
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id: targetId } = await params

    // 不允許重設自己的密碼
    if (admin.id === targetId) {
      return NextResponse.json(
        { error: "無法重設自己的密碼，請使用「更改密碼」功能" },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Zod 驗證
    const validation = validateData(adminResetPasswordSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "輸入驗證失敗", details: validation.errors },
        { status: 400 }
      )
    }

    const { new_password } = validation.data

    // 確認目標使用者存在且為 credentials 帳號
    const targetRows = await query(
      "SELECT id, password_hash FROM profiles WHERE id = $1",
      [targetId]
    )

    if (targetRows.length === 0) {
      return NextResponse.json(
        { error: "使用者不存在" },
        { status: 404 }
      )
    }

    if (!targetRows[0].password_hash) {
      return NextResponse.json(
        { error: "該使用者為 OAuth 帳號，無法重設密碼" },
        { status: 400 }
      )
    }

    // 產生新的 hash 並更新，同時標記需要強制更改密碼
    const newHash = await bcrypt.hash(new_password, 12)

    await query(
      "UPDATE profiles SET password_hash = $1, force_password_change = true, updated_at = NOW() WHERE id = $2",
      [newHash, targetId]
    )

    return NextResponse.json({ message: "密碼已重設" })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Admin Users/:id/reset-password] POST error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
