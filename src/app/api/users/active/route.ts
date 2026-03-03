/**
 * 活躍使用者列表 API
 * GET - 取得所有活躍且有 email 的使用者（用於指派人選擇器）
 */

import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAuth, AuthError } from "@/lib/auth"

// GET /api/users/active
export async function GET() {
  try {
    await requireAuth()

    const rows = await query(
      `SELECT id, name, avatar_url
       FROM profiles
       WHERE is_active = true AND email IS NOT NULL
       ORDER BY name ASC`
    )

    return NextResponse.json({ users: rows })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Users Active] GET error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
