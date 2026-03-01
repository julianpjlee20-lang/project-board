/**
 * Admin 專案概覽 API
 * GET - 取得所有專案列表（含統計）
 */

import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAdmin, AuthError } from "@/lib/auth"

// GET /api/admin/projects
export async function GET() {
  try {
    const _user = await requireAdmin()

    const rows = await query(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.status,
        p.created_at,
        (SELECT COUNT(*)
         FROM cards c
         JOIN columns col ON c.column_id = col.id
         WHERE col.project_id = p.id
        ) AS card_count,
        (SELECT COUNT(DISTINCT ca.user_id)
         FROM card_assignees ca
         JOIN cards c ON ca.card_id = c.id
         JOIN columns col ON c.column_id = col.id
         WHERE col.project_id = p.id
        ) AS member_count,
        pr.name AS creator_name
      FROM projects p
      LEFT JOIN profiles pr ON p.created_by = pr.id
      ORDER BY p.created_at DESC
    `)

    const projects = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      card_count: Number(row.card_count),
      member_count: Number(row.member_count),
      creator_name: row.creator_name,
      created_at: row.created_at,
    }))

    return NextResponse.json({ projects })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Admin Projects] GET error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
