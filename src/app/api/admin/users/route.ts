/**
 * Admin 使用者列表 API
 * GET - 取得使用者列表（搜尋、篩選、分頁）
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin, AuthError } from "@/lib/auth"

// 允許的排序欄位（白名單，防止 SQL injection）
const ALLOWED_SORT_FIELDS = ["created_at", "name", "email"] as const
const ALLOWED_ORDERS = ["asc", "desc"] as const

// GET /api/admin/users
export async function GET(request: NextRequest) {
  try {
    const _user = await requireAdmin()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const role = searchParams.get("role") || ""
    const isActiveParam = searchParams.get("is_active") || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20))
    const sort = ALLOWED_SORT_FIELDS.includes(searchParams.get("sort") as typeof ALLOWED_SORT_FIELDS[number])
      ? searchParams.get("sort")!
      : "created_at"
    const order = ALLOWED_ORDERS.includes(searchParams.get("order") as typeof ALLOWED_ORDERS[number])
      ? searchParams.get("order")!
      : "desc"

    // 動態建構 WHERE 條件
    const conditions: string[] = []
    const params: (string | number | boolean)[] = []
    let paramIndex = 1

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`)
      params.push(`%${search}%`)
      paramIndex++
    }

    if (role === "user" || role === "admin") {
      conditions.push(`role = $${paramIndex}`)
      params.push(role)
      paramIndex++
    }

    if (isActiveParam === "true" || isActiveParam === "false") {
      conditions.push(`is_active = $${paramIndex}`)
      params.push(isActiveParam === "true")
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const offset = (page - 1) * limit

    // 查詢使用者列表
    const usersQuery = `
      SELECT id, name, email, avatar_url, role, is_active,
             password_hash IS NOT NULL AS has_password,
             discord_user_id IS NOT NULL AS has_discord,
             created_at
      FROM profiles
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    const usersParams = [...params, limit, offset]

    // 查詢總數
    const countQuery = `SELECT COUNT(*) FROM profiles ${whereClause}`

    const [usersRows, countRows] = await Promise.all([
      query(usersQuery, usersParams),
      query(countQuery, params.length > 0 ? params : undefined),
    ])

    // 轉換 login_method 欄位
    const users = usersRows.map((row) => {
      let login_method: string
      if (row.has_password && row.has_discord) {
        login_method = "both"
      } else if (row.has_discord) {
        login_method = "discord"
      } else {
        login_method = "credentials"
      }

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        avatar_url: row.avatar_url,
        role: row.role,
        is_active: row.is_active,
        login_method,
        created_at: row.created_at,
      }
    })

    return NextResponse.json({
      users,
      total: Number(countRows[0].count),
      page,
      limit,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Admin Users] GET error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
