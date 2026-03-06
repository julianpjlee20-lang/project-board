/**
 * API Key 管理端點
 * 安全規範：
 * - 僅管理員 JWT 可操作（API Key 不能管理 API Key，防止提權）
 * - 明文金鑰只在生成時回傳一次
 * - 資料庫只存 SHA-256 hash
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { generateApiKey, hashApiKey, getKeyPrefix } from '@/lib/api-key'
import { requireAdminJwtOnly } from '@/lib/api-key-guard'
import { AuthError } from '@/lib/auth'
import { z } from 'zod'
import { validateData } from '@/lib/validations'
import { headers } from 'next/headers'

// 建立 API Key 的驗證 schema
const createApiKeySchema = z.object({
  name: z.string().min(1, '名稱不可為空').max(100, '名稱不可超過 100 字元'),
  permissions: z.enum(['full', 'read_only'], {
    message: '權限必須為 full 或 read_only'
  }).optional(),
  expires_at: z.string().regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
    '無效的日期格式'
  ).optional(),
})

// 撤銷 API Key 的驗證 schema
const revokeApiKeySchema = z.object({
  key_id: z.string().uuid('key_id 必須為有效的 UUID'),
  action: z.enum(['revoke', 'delete'], {
    message: 'action 必須為 revoke 或 delete'
  }).optional().default('revoke'),
})

// 重新生成 API Key 的驗證 schema
const regenerateApiKeySchema = z.object({
  key_id: z.string().uuid('key_id 必須為有效的 UUID'),
})

/**
 * POST /api/ai/keys — 生成新 API Key（僅管理員 JWT）
 */
export async function POST(request: Request) {
  try {
    await requireAdminJwtOnly()

    const body = await request.json()
    const validation = validateData(createApiKeySchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { name, permissions = 'full', expires_at } = validation.data

    // 生成 API Key
    const plainKey = generateApiKey()
    const keyHash = hashApiKey(plainKey)
    const keyPrefix = getKeyPrefix(plainKey)

    // 寫入資料庫
    const result = await query(
      `INSERT INTO api_keys (name, key_hash, key_prefix, permissions, expires_at, user_id)
       VALUES ($1, $2, $3, $4, $5, (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1))
       RETURNING id, name, key_prefix, permissions, expires_at, created_at`,
      [name, keyHash, keyPrefix, permissions, expires_at || null]
    )

    // 寫入審計日誌
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
    await query(
      `INSERT INTO api_key_audit_log (action, key_id, ip_address, user_agent)
       VALUES ('created', $1, $2, $3)`,
      [result[0].id, ip, h.get('user-agent') || null]
    )

    return NextResponse.json({
      success: true,
      key: result[0],
      // 明文金鑰只在這裡回傳一次！
      api_key: plainKey,
      warning: '請立即複製此 API Key，之後將無法再查看明文。',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/ai/keys error:', error)
    return NextResponse.json({
      error: '建立 API Key 失敗',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

/**
 * GET /api/ai/keys — 列出所有 API Key（僅管理員 JWT，不含明文）
 */
export async function GET() {
  try {
    await requireAdminJwtOnly()

    const keys = await query(
      `SELECT ak.id, ak.name, ak.key_prefix, ak.permissions, ak.is_active,
              ak.expires_at, ak.last_used_at, ak.created_at,
              p.name as owner_name, p.email as owner_email
       FROM api_keys ak
       JOIN profiles p ON ak.user_id = p.id
       ORDER BY ak.created_at DESC`
    )

    return NextResponse.json({ keys })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/ai/keys error:', error)
    return NextResponse.json({
      error: '取得 API Key 列表失敗',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

/**
 * PATCH /api/ai/keys — 重新生成 API Key（僅管理員 JWT）
 * 產生新的明文金鑰，更新 hash 和 prefix，明文只回傳一次
 */
export async function PATCH(request: Request) {
  try {
    await requireAdminJwtOnly()

    const body = await request.json()
    const validation = validateData(regenerateApiKeySchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { key_id } = validation.data

    // 確認 key 存在且為啟用狀態
    const existing = await query(
      'SELECT id, name, is_active FROM api_keys WHERE id = $1',
      [key_id]
    )
    if (existing.length === 0) {
      return NextResponse.json({ error: 'API Key 不存在' }, { status: 404 })
    }
    if (!existing[0].is_active) {
      return NextResponse.json({ error: '無法重新生成已撤銷的 API Key' }, { status: 400 })
    }

    // 生成新的 API Key
    const plainKey = generateApiKey()
    const keyHash = hashApiKey(plainKey)
    const keyPrefix = getKeyPrefix(plainKey)

    // 更新資料庫
    const result = await query(
      `UPDATE api_keys SET key_hash = $1, key_prefix = $2
       WHERE id = $3
       RETURNING id, name, key_prefix, permissions, expires_at, created_at`,
      [keyHash, keyPrefix, key_id]
    )

    // 寫入審計日誌
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
    await query(
      `INSERT INTO api_key_audit_log (action, key_id, ip_address, user_agent)
       VALUES ('regenerated', $1, $2, $3)`,
      [key_id, ip, h.get('user-agent') || null]
    )

    return NextResponse.json({
      success: true,
      key: result[0],
      api_key: plainKey,
      warning: '請立即複製此 API Key，之後將無法再查看明文。',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PATCH /api/ai/keys error:', error)
    return NextResponse.json({
      error: '重新生成 API Key 失敗',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

/**
 * DELETE /api/ai/keys — 撤銷或永久刪除 API Key（僅管理員 JWT）
 * action = 'revoke'（預設）：soft delete（設 is_active = false）
 * action = 'delete'：hard delete（僅限已撤銷的 key）
 */
export async function DELETE(request: Request) {
  try {
    await requireAdminJwtOnly()

    const body = await request.json()
    const validation = validateData(revokeApiKeySchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { key_id, action } = validation.data

    // 檢查 key 是否存在
    const existing = await query(
      'SELECT id, name, is_active FROM api_keys WHERE id = $1',
      [key_id]
    )
    if (existing.length === 0) {
      return NextResponse.json({ error: 'API Key 不存在' }, { status: 404 })
    }

    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
    const userAgent = h.get('user-agent') || null

    if (action === 'delete') {
      // 永久刪除：只能刪除已撤銷的 key
      if (existing[0].is_active) {
        return NextResponse.json({
          error: '只能永久刪除已撤銷的 API Key，請先撤銷再刪除'
        }, { status: 400 })
      }

      // 先寫審計日誌（因為 ON DELETE SET NULL 會讓 key_id 變 null）
      await query(
        `INSERT INTO api_key_audit_log (action, key_id, ip_address, user_agent)
         VALUES ('deleted', $1, $2, $3)`,
        [key_id, ip, userAgent]
      )

      // 永久刪除 key（audit log 的 FK 會因 ON DELETE SET NULL 自動設為 null）
      await query('DELETE FROM api_keys WHERE id = $1', [key_id])

      return NextResponse.json({
        success: true,
        message: `已永久刪除 API Key「${existing[0].name}」`,
      })
    }

    // 預設行為：撤銷（soft delete）
    await query('UPDATE api_keys SET is_active = false WHERE id = $1', [key_id])

    // 寫入審計日誌
    await query(
      `INSERT INTO api_key_audit_log (action, key_id, ip_address, user_agent)
       VALUES ('revoked', $1, $2, $3)`,
      [key_id, ip, userAgent]
    )

    return NextResponse.json({
      success: true,
      message: `已撤銷 API Key「${existing[0].name}」`,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('DELETE /api/ai/keys error:', error)
    return NextResponse.json({
      error: '操作 API Key 失敗',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
