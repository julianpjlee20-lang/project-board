import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { query } from "@/lib/db"
import { ensureProfilesTable } from "@/auth"
import { registerSchema, validateData } from "@/lib/validations"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = validateData(registerSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "輸入驗證失敗", details: validation.errors },
        { status: 400 }
      )
    }

    const { email, password, name } = validation.data

    await ensureProfilesTable()

    // 檢查 email 是否已被使用
    const existing = await query(
      "SELECT id FROM profiles WHERE email = $1",
      [email]
    )
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "此 Email 已被註冊" },
        { status: 409 }
      )
    }

    // 密碼雜湊
    const passwordHash = await bcrypt.hash(password, 12)

    // 建立帳號（預設 role='user'、is_active=false，需管理員審核）
    const rows = await query(
      "INSERT INTO profiles (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, 'user', false) RETURNING id",
      [name || null, email, passwordHash]
    )

    return NextResponse.json(
      { message: "註冊成功，請等待管理員審核後再登入", profileId: rows[0].id },
      { status: 201 }
    )
  } catch (error) {
    console.error("[Register] Error:", error)
    return NextResponse.json(
      { error: "註冊失敗，請稍後再試" },
      { status: 500 }
    )
  }
}
