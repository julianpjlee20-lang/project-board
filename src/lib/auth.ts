import { cookies } from 'next/headers'
import { query } from './db'

/** 當前登入使用者資訊 */
export interface CurrentUser {
  id: string
  name: string | null
  avatar_url: string | null
  line_user_id: string | null
  discord_user_id: string | null
}

/**
 * 取得當前登入使用者
 * 依序檢查 LINE cookie → Discord cookie，找到即回傳使用者資料
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies()

  // 優先檢查 LINE 登入
  const lineUserId = cookieStore.get('line_user_id')?.value
  if (lineUserId) {
    const users = await query(
      'SELECT id, name, avatar_url, line_user_id, discord_user_id FROM profiles WHERE line_user_id = $1',
      [lineUserId]
    )
    if (users.length > 0) return users[0] as CurrentUser
  }

  // 再檢查 Discord 登入
  const discordId = cookieStore.get('discord_id')?.value
  if (discordId) {
    const users = await query(
      'SELECT id, name, avatar_url, line_user_id, discord_user_id FROM profiles WHERE discord_user_id = $1',
      [discordId]
    )
    if (users.length > 0) return users[0] as CurrentUser
  }

  return null
}
