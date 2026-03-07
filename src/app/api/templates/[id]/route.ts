import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { updateTemplateSchema, validateData } from '@/lib/validations'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'

// PUT /api/templates/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { id: templateId } = await params
    const body = await request.json()

    // Zod 驗證
    const validation = validateData(updateTemplateSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    // 確認模板存在
    const templates = await query(
      'SELECT * FROM card_templates WHERE id = $1',
      [templateId]
    )
    if (templates.length === 0) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }

    const data = validation.data

    // 動態建構 UPDATE SET 語句（只更新有傳入的欄位）
    const fields: string[] = []
    const values: (string | number | boolean | null | undefined)[] = []
    let idx = 2 // $1 = templateId

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`)
      values.push(data.name)
    }
    if (data.title_pattern !== undefined) {
      fields.push(`title_pattern = $${idx++}`)
      values.push(data.title_pattern)
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`)
      values.push(data.description === '' ? '' : data.description)
    }
    if (data.priority !== undefined) {
      fields.push(`priority = $${idx++}`)
      values.push(data.priority)
    }
    if (data.target_column_id !== undefined) {
      fields.push(`target_column_id = $${idx++}`)
      values.push(data.target_column_id)
    }
    if (data.rolling_due_date !== undefined) {
      fields.push(`rolling_due_date = $${idx++}`)
      values.push(data.rolling_due_date)
    }
    fields.push(`updated_at = NOW()`)

    // 更新模板主體
    await query(
      `UPDATE card_templates SET ${fields.join(', ')} WHERE id = $1`,
      [templateId, ...values]
    )

    // 處理子任務：刪除舊的，批次插入新的
    if (data.subtasks !== undefined) {
      await query('DELETE FROM template_subtasks WHERE template_id = $1', [templateId])

      if (data.subtasks.length > 0) {
        for (const st of data.subtasks) {
          await query(`
            INSERT INTO template_subtasks (template_id, title, position, day_of_month, assignee_id)
            VALUES ($1, $2, $3, $4, $5)
          `, [templateId, st.title, st.position, st.day_of_month ?? null, st.assignee_id ?? null])
        }
      }
    }

    // 回傳更新後的完整模板（含子任務）
    const updated = await query(`
      SELECT ct.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ts.id, 'title', ts.title, 'position', ts.position,
              'day_of_month', ts.day_of_month, 'assignee_id', ts.assignee_id,
              'assignee_name', p.name
            ) ORDER BY ts.position
          ) FILTER (WHERE ts.id IS NOT NULL), '[]'
        ) as subtasks
      FROM card_templates ct
      LEFT JOIN template_subtasks ts ON ts.template_id = ct.id
      LEFT JOIN profiles p ON p.id = ts.assignee_id
      WHERE ct.id = $1
      GROUP BY ct.id
    `, [templateId])

    return NextResponse.json(updated[0])
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/templates/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

// DELETE /api/templates/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { id: templateId } = await params

    // 確認模板存在
    const templates = await query(
      'SELECT id FROM card_templates WHERE id = $1',
      [templateId]
    )
    if (templates.length === 0) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }

    // 刪除模板（template_subtasks 會因 CASCADE 自動刪除）
    await query('DELETE FROM card_templates WHERE id = $1', [templateId])

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('DELETE /api/templates/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
