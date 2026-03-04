import { auth } from "@/auth"
import { query } from "./db"
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { hashApiKey } from "./api-key"
import { checkRateLimit, recordAuthFailure, resetAuthFailures, isBlocked } from "./rate-limit"

export interface CurrentUser {
  id: string
  name: string | null
  avatar_url: string | null
  provider: string | null
  role: string
  permissions?: string  // API Key 專用：'full' | 'read_only'
}

/**
 * 從 request header 取得 API Key
 * 格式：Authorization: Bearer pb_xxx
 */
async function getApiKeyFromHeader(): Promise<string | null> {
  try {
    const h = await headers()
    const authorization = h.get('authorization')
    if (authorization?.startsWith('Bearer pb_')) {
      return authorization.slice(7)  // 去掉 "Bearer "
    }
  } catch {
    // headers() 可能在某些 context 中不可用（如 Server Components）
  }
  return null
}

/**
 * 取得請求者 IP（用於 rate limiting）
 */
async function getClientIp(): Promise<string> {
  try {
    const h = await headers()
    return h.get('x-forwarded-for')?.split(',')[0]?.trim()
      || h.get('x-real-ip')
      || 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * 透過 API Key 取得使用者
 * - 驗證 key hash、is_active、帳號 is_active
 * - 檢查過期時間
 * - 更新 last_used_at（非阻塞）
 * - 驗證失敗記錄審計日誌
 */
async function getUserFromApiKey(apiKey: string): Promise<CurrentUser | null> {
  const ip = await getClientIp()

  // Rate limit 檢查
  if (isBlocked(ip)) return null
  const rateCheck = checkRateLimit(ip)
  if (!rateCheck.allowed) return null

  const keyHash = hashApiKey(apiKey)
  const rows = await query(
    `SELECT ak.id as key_id, ak.user_id, ak.permissions, ak.expires_at,
            p.name, p.avatar_url, p.role, p.is_active as user_active
     FROM api_keys ak
     JOIN profiles p ON ak.user_id = p.id
     WHERE ak.key_hash = $1 AND ak.is_active = true`,
    [keyHash]
  )

  if (rows.length === 0) {
    // 驗證失敗：記錄
    recordAuthFailure(ip)
    // 寫入審計日誌（非阻塞）
    query(
      `INSERT INTO api_key_audit_log (action, ip_address) VALUES ('auth_failed', $1)`,
      [ip]
    ).catch(() => {})  // 審計日誌寫入失敗不影響主流程
    return null
  }

  const row = rows[0]

  // 檢查帳號是否啟用
  if (!row.user_active) return null

  // 檢查是否過期
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    query(
      `INSERT INTO api_key_audit_log (action, key_id, ip_address) VALUES ('expired_rejected', $1, $2)`,
      [row.key_id, ip]
    ).catch(() => {})
    return null
  }

  // 驗證成功：重置失敗計數
  resetAuthFailures(ip)

  // 更新 last_used_at（非阻塞）
  query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.key_id]).catch(() => {})

  return {
    id: row.user_id,
    name: row.name,
    avatar_url: row.avatar_url,
    provider: 'api_key',
    role: row.role,
    permissions: row.permissions,
  }
}

/**
 * 取得當前登入使用者
 * 1. 先嘗試 API Key（Authorization: Bearer pb_xxx）
 * 2. 再嘗試 JWT session（Auth.js）
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // 1. 嘗試 API Key
  const apiKey = await getApiKeyFromHeader()
  if (apiKey) {
    return getUserFromApiKey(apiKey)
  }

  // 2. 原有的 JWT session 邏輯
  const session = await auth()
  if (!session?.user?.profileId) return null

  return {
    id: session.user.profileId,
    name: session.user.name ?? null,
    avatar_url: session.user.image ?? null,
    provider: session.user.provider ?? null,
    role: session.user.role ?? 'user',
  }
}

/**
 * 認證錯誤類別
 */
export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * 要求登入，未登入則拋出 AuthError
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new AuthError('未登入', 401)
  }
  return user
}

/**
 * 要求管理員權限，非管理員則拋出 AuthError
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth()
  if (user.role !== 'admin') {
    throw new AuthError('權限不足', 403)
  }
  return user
}

/**
 * 取得完整 profile（含 provider IDs），僅在需要時查 DB
 * 用於通知系統等需要 line_user_id 的場景
 */
export async function getFullProfile(profileId: string) {
  const rows = await query("SELECT * FROM profiles WHERE id = $1", [profileId])
  return rows[0] || null
}
