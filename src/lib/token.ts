import crypto from 'crypto'

/** 產生安全隨機 reset token（32 bytes → 64 hex chars） */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/** 將 token 做 SHA-256 hash（存入 DB 用） */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
