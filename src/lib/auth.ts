import { auth } from "@/auth"
import { query } from "./db"

export interface CurrentUser {
  id: string
  name: string | null
  avatar_url: string | null
  provider: string | null
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
  }
}

/**
 * 取得完整 profile（含 provider IDs），僅在需要時查 DB
 * 用於通知系統等需要 line_user_id 的場景
 */
export async function getFullProfile(profileId: string) {
  const rows = await query("SELECT * FROM profiles WHERE id = $1", [profileId])
  return rows[0] || null
}
