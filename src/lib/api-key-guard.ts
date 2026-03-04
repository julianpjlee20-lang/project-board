/**
 * API Key 寫入權限檢查
 * - read_only 的 Key 不能執行 POST/PUT/DELETE
 * - API Key 不能管理其他 API Key（防止提權）
 */

import { getCurrentUser, AuthError, type CurrentUser } from './auth'

/**
 * 檢查使用者是否有寫入權限（接受已取得的 user 避免重複查詢）
 * read_only 的 API Key 呼叫寫入端點時回傳 403
 * JWT session 使用者和 full 權限的 API Key 正常通過
 */
export function checkWritePermission(user: CurrentUser): void {
  if (user.provider === 'api_key' && user.permissions === 'read_only') {
    throw new AuthError('此 API Key 為唯讀權限，無法執行寫入操作', 403)
  }
}

/**
 * 獨立版本：自行取得 user 並檢查寫入權限
 * 用於不需要 user 物件的場景
 */
export async function requireWritePermission(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return  // 未登入的情況由 requireAuth() 處理
  checkWritePermission(user)
}

/**
 * 要求必須是管理員 JWT 登入（API Key 不可管理 API Key）
 * 用於 /api/ai/keys 端點，防止 API Key 提權
 */
export async function requireAdminJwtOnly(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) {
    throw new AuthError('未登入', 401)
  }
  if (user.provider === 'api_key') {
    throw new AuthError('API Key 無法管理 API Key，請使用管理員帳號登入', 403)
  }
  if (user.role !== 'admin') {
    throw new AuthError('權限不足，僅管理員可管理 API Key', 403)
  }
}
