/**
 * Rate Limiting — 滑動窗口 + IP 鎖定
 * - 每個 IP 每分鐘最多 60 次 API Key 請求
 * - 連續 10 次驗證失敗 → 該 IP 鎖定 15 分鐘
 * - In-memory 實作，適合單一實例部署（Zeabur）
 */

const WINDOW_MS = 60_000           // 1 分鐘窗口
const MAX_REQUESTS = 60            // 每分鐘最多 60 次
const BLOCK_AFTER_FAILURES = 10    // 連續失敗 10 次鎖定
const BLOCK_DURATION_MS = 15 * 60_000  // 鎖定 15 分鐘

interface RateLimitEntry {
  timestamps: number[]  // 請求時間戳列表
}

interface FailureEntry {
  count: number
  blockedUntil: number | null
}

const requestMap = new Map<string, RateLimitEntry>()
const failureMap = new Map<string, FailureEntry>()

// 定期清理過期記錄（每 5 分鐘）
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of requestMap.entries()) {
    entry.timestamps = entry.timestamps.filter(t => now - t < WINDOW_MS)
    if (entry.timestamps.length === 0) requestMap.delete(ip)
  }
  for (const [ip, entry] of failureMap.entries()) {
    if (entry.blockedUntil && now > entry.blockedUntil) {
      failureMap.delete(ip)
    }
  }
}, 5 * 60_000)

/** 檢查 IP 是否被鎖定 */
export function isBlocked(ip: string): boolean {
  const entry = failureMap.get(ip)
  if (!entry?.blockedUntil) return false
  if (Date.now() > entry.blockedUntil) {
    failureMap.delete(ip)
    return false
  }
  return true
}

/** 檢查 rate limit，回傳是否允許 */
export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  // 先檢查是否被鎖定
  if (isBlocked(ip)) {
    const entry = failureMap.get(ip)!
    const retryAfter = Math.ceil((entry.blockedUntil! - Date.now()) / 1000)
    return { allowed: false, retryAfter }
  }

  const now = Date.now()
  let entry = requestMap.get(ip)

  if (!entry) {
    entry = { timestamps: [] }
    requestMap.set(ip, entry)
  }

  // 移除窗口外的時間戳
  entry.timestamps = entry.timestamps.filter(t => now - t < WINDOW_MS)

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfter = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000)
    return { allowed: false, retryAfter }
  }

  entry.timestamps.push(now)
  return { allowed: true }
}

/** 記錄驗證失敗（累計失敗次數） */
export function recordAuthFailure(ip: string): void {
  let entry = failureMap.get(ip)
  if (!entry) {
    entry = { count: 0, blockedUntil: null }
    failureMap.set(ip, entry)
  }
  entry.count++
  if (entry.count >= BLOCK_AFTER_FAILURES) {
    entry.blockedUntil = Date.now() + BLOCK_DURATION_MS
  }
}

/** 驗證成功時重置失敗計數 */
export function resetAuthFailures(ip: string): void {
  failureMap.delete(ip)
}
