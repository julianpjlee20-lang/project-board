import { auth } from "@/auth"
import { query } from "./db"
import { NextResponse } from "next/server"

export interface CurrentUser {
  id: string
  name: string | null
  avatar_url: string | null
  provider: string | null
  role: string
}

/**
 * 取得當前登入使用者（從 JWT session，不查 DB）
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
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
