import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createCardSchema, validateData } from '@/lib/validations'

// POST /api/cards
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Zod 驗證
    const validation = validateData(createCardSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { column_id, title } = validation.data

    // 取得 project_id（透過 column_id）
    const colResult = await query(
      'SELECT project_id FROM columns WHERE id = $1',
      [column_id]
    )
    if (colResult.length === 0) {
      return NextResponse.json({ error: '欄位不存在' }, { status: 400 })
    }
    const projectId = colResult[0].project_id

    // Get max position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM cards WHERE column_id = $1',
      [column_id]
    )
    const position = posResult[0]?.pos || 0

    // 原子取號：鎖定 project row 確保並發安全，再取 max card_number + 1
    const result = await query(`
      WITH lock_project AS (
        SELECT id FROM projects WHERE id = $1 FOR UPDATE
      ),
      next_number AS (
        SELECT COALESCE(MAX(c.card_number), 0) + 1 AS next_num
        FROM cards c
        JOIN columns col ON c.column_id = col.id
        WHERE col.project_id = $1
      )
      INSERT INTO cards (column_id, title, position, card_number)
      SELECT $2, $3, $4, next_num
      FROM next_number
      RETURNING *
    `, [projectId, column_id, title, position])

    return NextResponse.json(result[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create card' }, { status: 500 })
  }
}
