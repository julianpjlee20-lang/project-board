/**
 * AI 專用：批次更新端點
 * 一次更新多張卡片（進度、優先度、移動欄位等，最多 50 筆）
 * 安全規範：
 * - requireAuth() + requireWritePermission() 保護
 * - 每筆更新獨立 try-catch，單筆失敗不中斷整批
 * - 所有變更寫入 activity_logs
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { requireWritePermission } from '@/lib/api-key-guard'
import { z } from 'zod'
import { validateData } from '@/lib/validations'

// 批次更新的驗證 schema
const batchUpdateSchema = z.object({
  updates: z.array(z.object({
    card_id: z.string().uuid('card_id 必須為有效的 UUID'),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional().or(z.literal('')),
    progress: z.number().int().min(0).max(100).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/).optional().or(z.literal('')),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/).optional().or(z.literal('')),
    phase_id: z.string().uuid().optional().or(z.literal('')),
    assignee_id: z.string().uuid().optional().or(z.literal('')),
    move_to_column: z.string().optional(),
  })).min(1, '至少需要一筆更新').max(50, '每次最多 50 筆更新'),
  project_id: z.string().uuid('project_id 必須為有效的 UUID').optional(),
})

/**
 * POST /api/ai/batch — 批次更新卡片
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    await requireWritePermission()

    const body = await request.json()
    const validation = validateData(batchUpdateSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { updates, project_id } = validation.data
    const results: { card_id: string; status: string; detail?: string; card_number?: number }[] = []

    for (const upd of updates) {
      try {
        // 取得舊卡片資料
        const oldCards = await query('SELECT * FROM cards WHERE id = $1', [upd.card_id])
        if (oldCards.length === 0) {
          results.push({ card_id: upd.card_id, status: 'error', detail: '卡片不存在' })
          continue
        }
        const old = oldCards[0]

        // 取得 project_id
        const colResult = await query('SELECT project_id FROM columns WHERE id = $1', [old.column_id])
        const pid = colResult[0]?.project_id

        // 動態建構 UPDATE
        const sets: string[] = []
        const values: (string | number | null)[] = []
        let idx = 1

        const fieldMap: { key: string; col: string; logTarget: string }[] = [
          { key: 'title', col: 'title', logTarget: '標題' },
          { key: 'description', col: 'description', logTarget: '描述' },
          { key: 'progress', col: 'progress', logTarget: '進度' },
          { key: 'priority', col: 'priority', logTarget: '優先度' },
          { key: 'due_date', col: 'due_date', logTarget: '截止日' },
          { key: 'start_date', col: 'start_date', logTarget: '開始日期' },
          { key: 'phase_id', col: 'phase_id', logTarget: '階段' },
        ]

        for (const field of fieldMap) {
          const val = (upd as Record<string, unknown>)[field.key]
          if (val !== undefined) {
            const dbVal = val === '' ? null : val
            sets.push(`${field.col} = $${idx++}`)
            values.push(dbVal as string | number | null)

            // Activity log
            const oldVal = old[field.col]
            if (String(oldVal ?? '') !== String(dbVal ?? '')) {
              const oldDisplay = field.key === 'progress' ? `${oldVal ?? 0}%` :
                (oldVal ? String(oldVal).split('T')[0] : '(未設定)')
              const newDisplay = field.key === 'progress' ? `${dbVal}%` :
                (dbVal ? String(dbVal).split('T')[0] : '(未設定)')
              await query(
                `INSERT INTO activity_logs (project_id, card_id, user_id, action, target, old_value, new_value)
                 VALUES ($1, $2, $3, '修改', $4, $5, $6)`,
                [pid, upd.card_id, user.id, field.logTarget, oldDisplay, newDisplay]
              )
            }
          }
        }

        if (sets.length > 0) {
          sets.push('updated_at = NOW()')
          values.push(upd.card_id)
          await query(`UPDATE cards SET ${sets.join(', ')} WHERE id = $${idx}`, values)
        }

        // 處理指派人
        if (upd.assignee_id !== undefined) {
          const oldAssignee = await query(
            `SELECT p.name FROM profiles p JOIN card_assignees ca ON p.id = ca.user_id
             WHERE ca.card_id = $1`, [upd.card_id]
          )
          const oldName = oldAssignee[0]?.name || '(未指派)'

          await query('DELETE FROM card_assignees WHERE card_id = $1', [upd.card_id])

          if (upd.assignee_id && upd.assignee_id !== '') {
            const assigneeUser = await query('SELECT id, name FROM profiles WHERE id = $1', [upd.assignee_id])
            if (assigneeUser.length > 0) {
              await query('INSERT INTO card_assignees (card_id, user_id) VALUES ($1, $2)',
                [upd.card_id, assigneeUser[0].id])
              await query(
                `INSERT INTO activity_logs (project_id, card_id, user_id, action, target, old_value, new_value)
                 VALUES ($1, $2, $3, '指派', '負責人', $4, $5)`,
                [pid, upd.card_id, user.id, oldName, assigneeUser[0].name]
              )
            }
          } else if (oldName !== '(未指派)') {
            await query(
              `INSERT INTO activity_logs (project_id, card_id, user_id, action, target, old_value, new_value)
               VALUES ($1, $2, $3, '取消指派', '負責人', $4, '(未指派)')`,
              [pid, upd.card_id, user.id, oldName]
            )
          }
        }

        // 移動欄位
        if (upd.move_to_column) {
          const targetPid = project_id || pid
          const cols = await query(
            'SELECT id, name FROM columns WHERE project_id = $1 AND name ILIKE $2',
            [targetPid, upd.move_to_column]
          )
          if (cols.length > 0) {
            const destColId = cols[0].id
            const posResult = await query(
              'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM cards WHERE column_id = $1',
              [destColId]
            )
            await query(
              'UPDATE cards SET column_id = $1, position = $2, updated_at = NOW() WHERE id = $3',
              [destColId, posResult[0]?.pos || 0, upd.card_id]
            )
            const srcCol = await query('SELECT name FROM columns WHERE id = $1', [old.column_id])
            await query(
              `INSERT INTO activity_logs (project_id, card_id, user_id, action, target, old_value, new_value)
               VALUES ($1, $2, $3, '移動', '欄位', $4, $5)`,
              [pid, upd.card_id, user.id, srcCol[0]?.name, cols[0].name]
            )
          }
        }

        results.push({ card_id: upd.card_id, status: 'ok', card_number: old.card_number })
      } catch (innerErr) {
        results.push({
          card_id: upd.card_id,
          status: 'error',
          detail: innerErr instanceof Error ? innerErr.message : String(innerErr),
        })
      }
    }

    const successCount = results.filter(r => r.status === 'ok').length
    return NextResponse.json({
      success: true,
      summary: `${successCount}/${updates.length} 筆更新成功`,
      results,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/ai/batch error:', error)
    return NextResponse.json({
      error: '批次更新失敗',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
