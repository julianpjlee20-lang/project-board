import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { archiveCardSchema, validateData } from '@/lib/validations'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'

// PATCH /api/cards/[id]/archive — 封存/取消封存卡片
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { id } = await params
    const body = await request.json()

    // Zod 驗證
    const validation = validateData(archiveCardSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { is_archived } = validation.data

    // 確認 card 存在
    const existing = await query('SELECT * FROM cards WHERE id = $1', [id])
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }
    const card = existing[0]

    // 取得 project_id（透過 column_id）
    const colResult = await query('SELECT project_id FROM columns WHERE id = $1', [card.column_id])
    const projectId = colResult[0]?.project_id || null

    let updatedCard

    if (is_archived) {
      // 封存卡片
      const result = await query(
        'UPDATE cards SET is_archived = true, archived_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      )
      updatedCard = result[0]

      // 寫入 activity_logs
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target) VALUES ($1, $2, $3, $4)',
        [projectId, id, 'archived', card.title]
      )
    } else {
      // 取消封存：將卡片放回原 column 的最後位置
      const posResult = await query(
        'SELECT COALESCE(MAX(position), -1) as max_pos FROM cards WHERE column_id = $1 AND (is_archived = false OR is_archived IS NULL)',
        [card.column_id]
      )
      const newPosition = (posResult[0]?.max_pos ?? -1) + 1

      const result = await query(
        'UPDATE cards SET is_archived = false, archived_at = NULL, position = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
        [id, newPosition]
      )
      updatedCard = result[0]

      // 寫入 activity_logs
      await query(
        'INSERT INTO activity_logs (project_id, card_id, action, target) VALUES ($1, $2, $3, $4)',
        [projectId, id, 'unarchived', card.title]
      )
    }

    return NextResponse.json({ success: true, card: updatedCard })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[PATCH /api/cards/[id]/archive] Error:', errMsg)
    return NextResponse.json({
      error: 'Failed to archive/unarchive card',
      detail: errMsg
    }, { status: 500 })
  }
}
