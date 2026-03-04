/**
 * API Key 工具函式
 * - 金鑰格式：pb_ + 64 字元 hex（256 bit 熵）
 * - 資料庫只存 SHA-256 hash，永遠不存明文
 */

import { createHash, randomBytes } from 'crypto'

/** 生成 256-bit 隨機 API Key（pb_ 前綴方便識別） */
export function generateApiKey(): string {
  return 'pb_' + randomBytes(32).toString('hex')
}

/** SHA-256 hash（資料庫只存 hash） */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/** 取得 key 的前綴（用於識別，不暴露完整 key） */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 10) + '...'
}
