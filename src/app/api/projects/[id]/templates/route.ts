import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { createTemplateSchema, validateData } from '@/lib/validations'
import { requireAuth, AuthError } from '@/lib/auth'
import { checkWritePermission } from '@/lib/api-key-guard'

// GET /api/projects/[id]/templates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id: projectId } = await params

    const templates = await query(`
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
      WHERE ct.project_id = $1
      GROUP BY ct.id
      ORDER BY ct.created_at DESC
    `, [projectId])

    return NextResponse.json({ templates })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/projects/[id]/templates error:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST /api/projects/[id]/templates
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    checkWritePermission(user)

    const { id: projectId } = await params
    const body = await request.json()

    // 檢查是否為「從卡片建立」模式
    const sourceCardId = body.source_card_id as string | undefined

    if (sourceCardId) {
      // === 從卡片建立模板 ===
      const cards = await query(
        'SELECT * FROM cards WHERE id = $1',
        [sourceCardId]
      )
      if (cards.length === 0) {
        return NextResponse.json({ error: '來源卡片不存在' }, { status: 404 })
      }
      const card = cards[0]

      // 取得卡片的子任務
      const cardSubtasks = await query(
        'SELECT * FROM subtasks WHERE card_id = $1 ORDER BY position',
        [sourceCardId]
      )

      // 用卡片資訊建立模板
      const templateResult = await query(`
        INSERT INTO card_templates (project_id, name, title_pattern, description, priority, target_column_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        projectId,
        card.title,
        card.title,
        card.description || '',
        card.priority || 'medium',
        card.column_id,
      ])
      const template = templateResult[0]

      // 複製子任務為模板子任務
      const subtasks = []
      for (let i = 0; i < cardSubtasks.length; i++) {
        const st = cardSubtasks[i]
        // 嘗試從子任務的 due_date 提取 day_of_month
        let dayOfMonth: number | null = null
        if (st.due_date) {
          const date = new Date(st.due_date)
          dayOfMonth = date.getDate()
        }

        const stResult = await query(`
          INSERT INTO template_subtasks (template_id, title, position, day_of_month, assignee_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [template.id, st.title, i, dayOfMonth, st.assignee_id || null])

        // 取得 assignee_name
        let assigneeName = null
        if (st.assignee_id) {
          const profileResult = await query('SELECT name FROM profiles WHERE id = $1', [st.assignee_id])
          if (profileResult.length > 0) assigneeName = profileResult[0].name
        }

        subtasks.push({ ...stResult[0], assignee_name: assigneeName })
      }

      return NextResponse.json({ ...template, subtasks }, { status: 201 })
    }

    // === 空白建立模板 ===
    const validation = validateData(createTemplateSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { name, title_pattern, description, priority, target_column_id, rolling_due_date, subtasks: subtaskInputs } = validation.data

    const templateResult = await query(`
      INSERT INTO card_templates (project_id, name, title_pattern, description, priority, target_column_id, rolling_due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      projectId,
      name,
      title_pattern,
      description || '',
      priority || 'medium',
      target_column_id,
      rolling_due_date ?? false,
    ])
    const template = templateResult[0]

    // 批次建立子任務
    const subtasks = []
    if (subtaskInputs && subtaskInputs.length > 0) {
      for (const st of subtaskInputs) {
        const stResult = await query(`
          INSERT INTO template_subtasks (template_id, title, position, day_of_month, assignee_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [template.id, st.title, st.position, st.day_of_month ?? null, st.assignee_id ?? null])

        // 取得 assignee_name
        let assigneeName = null
        if (st.assignee_id) {
          const profileResult = await query('SELECT name FROM profiles WHERE id = $1', [st.assignee_id])
          if (profileResult.length > 0) assigneeName = profileResult[0].name
        }

        subtasks.push({ ...stResult[0], assignee_name: assigneeName })
      }
    }

    return NextResponse.json({ ...template, subtasks }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/projects/[id]/templates error:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
