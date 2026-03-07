/**
 * Admin 使用者詳情 / 編輯 API
 * GET   - 取得使用者詳情（含統計）
 * PATCH - 編輯使用者（角色、啟用狀態、名稱）
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin, AuthError } from "@/lib/auth"
import { adminUpdateUserSchema, validateData } from "@/lib/validations"

// GET /api/admin/users/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const _user = await requireAdmin()
    const { id } = await params

    // 取得使用者 profile（排除 password_hash）
    const profileRows = await query(
      `SELECT id, name, email, avatar_url, role, is_active,
              password_hash IS NOT NULL AS has_password,
              discord_user_id IS NOT NULL AS has_discord,
              discord_user_id, created_at, updated_at, force_password_change
       FROM profiles
       WHERE id = $1`,
      [id]
    )

    if (profileRows.length === 0) {
      return NextResponse.json({ error: "使用者不存在" }, { status: 404 })
    }

    const profile = profileRows[0]

    // 取得相關統計
    const [projectCountRows, cardCountRows] = await Promise.all([
      query("SELECT COUNT(*) FROM projects WHERE created_by = $1", [id]),
      query("SELECT COUNT(*) FROM card_assignees WHERE user_id = $1", [id]),
    ])

    // 判斷登入方式
    let login_method: string
    if (profile.has_password && profile.has_discord) {
      login_method = "both"
    } else if (profile.has_discord) {
      login_method = "discord"
    } else {
      login_method = "credentials"
    }

    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      avatar_url: profile.avatar_url,
      role: profile.role,
      is_active: profile.is_active,
      login_method,
      discord_user_id: profile.discord_user_id,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      force_password_change: profile.force_password_change || false,
      stats: {
        project_count: Number(projectCountRows[0].count),
        assigned_card_count: Number(cardCountRows[0].count),
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Admin Users/:id] GET error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// DELETE /api/admin/users/[id]
// Body (optional): { transfer_to?: string } — 將卡片轉移給代理人
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAdmin()
    const { id: targetId } = await params

    // 安全約束 1：不可刪除自己
    if (targetId === currentUser.id) {
      return NextResponse.json(
        { error: "無法刪除自己的帳號" },
        { status: 403 }
      )
    }

    // 確認目標使用者存在
    const targetRows = await query(
      "SELECT id, role, is_active, name, email FROM profiles WHERE id = $1",
      [targetId]
    )
    if (targetRows.length === 0) {
      return NextResponse.json({ error: "使用者不存在" }, { status: 404 })
    }

    const target = targetRows[0]

    // 安全約束 2：不可刪除最後一個 admin
    if (target.role === "admin" && target.is_active) {
      const adminCountRows = await query(
        "SELECT COUNT(*) FROM profiles WHERE role = $1 AND is_active = true AND id != $2",
        ["admin", targetId]
      )
      if (Number(adminCountRows[0].count) === 0) {
        return NextResponse.json(
          { error: "無法刪除最後一個管理員" },
          { status: 400 }
        )
      }
    }

    // 解析 body（可能為空）
    let transferTo: string | undefined
    try {
      const body = await request.json()
      transferTo = body.transfer_to
    } catch {
      // body 為空或非 JSON，不轉移
    }

    // 若指定代理人，驗證代理人存在且為 active
    let transferredCount = 0
    if (transferTo) {
      if (transferTo === targetId) {
        return NextResponse.json(
          { error: "代理人不可為被刪除的使用者" },
          { status: 400 }
        )
      }

      const agentRows = await query(
        "SELECT id, name FROM profiles WHERE id = $1 AND is_active = true",
        [transferTo]
      )
      if (agentRows.length === 0) {
        return NextResponse.json(
          { error: "代理人不存在或已停用" },
          { status: 400 }
        )
      }

      // 計算要轉移的卡片數量
      const countRows = await query(
        "SELECT COUNT(*) FROM card_assignees WHERE user_id = $1",
        [targetId]
      )
      transferredCount = Number(countRows[0].count)

      // 轉移卡片指派（避免重複：若代理人已指派同卡片則刪除舊的）
      await query(
        `DELETE FROM card_assignees
         WHERE user_id = $1
           AND card_id IN (SELECT card_id FROM card_assignees WHERE user_id = $2)`,
        [transferTo, targetId]
      )
      await query(
        "UPDATE card_assignees SET user_id = $1 WHERE user_id = $2",
        [transferTo, targetId]
      )
    } else {
      await query("DELETE FROM card_assignees WHERE user_id = $1", [targetId])
    }

    // 刪除其餘關聯資料，再刪除使用者
    await query("DELETE FROM notification_dismissed WHERE user_id = $1", [targetId])
    await query("DELETE FROM profiles WHERE id = $1", [targetId])

    return NextResponse.json({
      message: `已刪除使用者「${target.name || target.email}」`,
      transferred_count: transferredCount,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Admin Users/:id] DELETE error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}

// PATCH /api/admin/users/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireAdmin()
    const { id: targetId } = await params

    const body = await request.json()

    // Zod 驗證
    const validation = validateData(adminUpdateUserSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "輸入驗證失敗", details: validation.errors },
        { status: 400 }
      )
    }

    const data = validation.data

    // 確認目標使用者存在
    const targetRows = await query(
      "SELECT id, role, is_active FROM profiles WHERE id = $1",
      [targetId]
    )
    if (targetRows.length === 0) {
      return NextResponse.json({ error: "使用者不存在" }, { status: 404 })
    }

    // 安全約束 1：不可停用自己
    if (targetId === currentUser.id && data.is_active === false) {
      return NextResponse.json(
        { error: "無法停用自己的帳號" },
        { status: 403 }
      )
    }

    // 安全約束 2：不可降級自己
    if (targetId === currentUser.id && data.role === "user") {
      return NextResponse.json(
        { error: "無法降級自己的角色" },
        { status: 403 }
      )
    }

    // 安全約束 3：不可移除最後一個 admin
    if (data.role === "user" || data.is_active === false) {
      const adminCountRows = await query(
        "SELECT COUNT(*) FROM profiles WHERE role = $1 AND is_active = true AND id != $2",
        ["admin", targetId]
      )
      const remainingAdmins = Number(adminCountRows[0].count)

      // 只有當目標本身是 active admin 時，才需要檢查
      const target = targetRows[0]
      if (target.role === "admin" && target.is_active && remainingAdmins === 0) {
        return NextResponse.json(
          { error: "無法移除最後一個管理員" },
          { status: 400 }
        )
      }
    }

    // 動態建構 UPDATE SET 子句
    const setClauses: string[] = []
    const updateParams: (string | boolean)[] = []
    let paramIndex = 1

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`)
      updateParams.push(data.name)
      paramIndex++
    }

    if (data.role !== undefined) {
      setClauses.push(`role = $${paramIndex}`)
      updateParams.push(data.role)
      paramIndex++
    }

    if (data.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex}`)
      updateParams.push(data.is_active)
      paramIndex++
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "未提供更新欄位" }, { status: 400 })
    }

    setClauses.push("updated_at = NOW()")
    updateParams.push(targetId)

    const updateQuery = `
      UPDATE profiles
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, avatar_url, role, is_active, created_at, updated_at
    `

    const updatedRows = await query(updateQuery, updateParams)

    return NextResponse.json(updatedRows[0])
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Admin Users/:id] PATCH error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
