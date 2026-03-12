import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { createColumnSchema, updateColumnSchema, deleteColumnSchema, validateData } from '@/lib/validations'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'

// GET /api/columns
export async function GET() {
  try {
    const columns = await query("SELECT * FROM columns ORDER BY position")
    return NextResponse.json(columns)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch columns' }, { status: 500 })
  }
}

// POST /api/columns
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const body = await request.json()

    // Zod 驗證
    const validation = validateData(createColumnSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { project_id, name, color } = validation.data

    // Get max position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM columns WHERE project_id = $1',
      [project_id]
    )
    const position = posResult[0]?.pos || 0

    const result = await query(
      'INSERT INTO columns (project_id, name, color, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_id, name, color || '#4EA7FC', position]
    )

    return NextResponse.json(result[0])
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create column' }, { status: 500 })
  }
}

// PUT /api/columns - update column
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const body = await request.json()

    // Zod 驗證
    const validation = validateData(updateColumnSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { id, name, color, position } = validation.data

    const result = await query(
      'UPDATE columns SET name = COALESCE($1, name), color = COALESCE($2, color), position = COALESCE($3, position) WHERE id = $4 RETURNING *',
      [name, color, position, id]
    )

    return NextResponse.json(result[0])
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update column' }, { status: 500 })
  }
}

// DELETE /api/columns
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const targetColumnId = searchParams.get('targetColumnId')

    // Zod 驗證
    const validation = validateData(deleteColumnSchema, {
      id,
      targetColumnId: targetColumnId ?? undefined,
    })
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    // 檢查欄位內卡片數量
    const countResult = await query(
      'SELECT COUNT(*)::int as count FROM cards WHERE column_id = $1',
      [validation.data.id]
    )
    const cardCount = countResult[0]?.count || 0

    if (cardCount > 0 && !validation.data.targetColumnId) {
      return NextResponse.json({
        error: `此欄位包含 ${cardCount} 個卡片，請指定目標欄位以遷移卡片`,
        cardCount,
      }, { status: 400 })
    }

    // 驗證目標欄位存在且屬於同一 project
    if (validation.data.targetColumnId) {
      const targetCheck = await query(
        `SELECT id FROM columns
         WHERE id = $1
           AND project_id = (SELECT project_id FROM columns WHERE id = $2)`,
        [validation.data.targetColumnId, validation.data.id]
      )
      if (targetCheck.length === 0) {
        return NextResponse.json({
          error: '目標欄位不存在或不屬於同一專案',
        }, { status: 400 })
      }
    }

    // 使用 transaction 確保遷移 + 刪除的原子性
    const client = await getClient()
    try {
      await client.query('BEGIN')

      // 若有卡片，先遷移到目標欄位
      if (cardCount > 0 && validation.data.targetColumnId) {
        const posResult = await client.query(
          'SELECT COALESCE(MAX(position), -1) + 1 as offset FROM cards WHERE column_id = $1 FOR UPDATE',
          [validation.data.targetColumnId]
        )
        const offset = posResult.rows[0]?.offset || 0

        await client.query(
          'UPDATE cards SET column_id = $1, position = position + $2 WHERE column_id = $3',
          [validation.data.targetColumnId, offset, validation.data.id]
        )
      }

      await client.query('DELETE FROM columns WHERE id = $1', [validation.data.id])
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete column' }, { status: 500 })
  }
}
