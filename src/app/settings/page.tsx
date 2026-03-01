'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { updateProfileSchema, changePasswordSchema, validateData } from '@/lib/validations'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
  role: string
  provider: 'credentials' | 'discord'
  discord_connected: boolean
  created_at: string
}

interface NotificationPreferences {
  notify_assigned: boolean
  notify_title_changed: boolean
  notify_due_soon: boolean
  notify_moved: boolean
  quiet_hours_start: number | null
  quiet_hours_end: number | null
}

// ─── Styles (aligned with existing pages) ──────────────────────────────────────

const COLORS = {
  bg: '#F9F8F5',
  primary: '#0B1A14',
  headerBg: '#0B1A14',
  headerBorder: '#316745',
  headerText: '#F9F8F5',
  accent: '#F8B500',
  green: '#316745',
  white: '#FFFFFF',
}

const inputClassName =
  'w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm bg-white'

const inputDisabledClassName =
  'w-full px-4 py-3 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500 cursor-not-allowed'

const buttonPrimaryClassName =
  'px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * 過濾頭像 URL，僅允許 http/https 協議用於即時預覽
 * 防止 javascript: 或 data: URL 被渲染為 img src
 */
function isSafeAvatarUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function AlertBanner({ type, message }: { type: 'success' | 'error'; message: string }) {
  const bg = type === 'success' ? 'bg-green-50' : 'bg-red-50'
  const text = type === 'success' ? 'text-green-600' : 'text-red-600'
  return (
    <div className={`mt-4 px-4 py-3 rounded-lg ${bg} ${text} text-sm`} role="alert">
      {message}
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-500">{message}</p>
}

function SkeletonCard() {
  return (
    <section className="rounded-xl border shadow-sm p-6 animate-pulse" style={{ backgroundColor: COLORS.white }}>
      <div className="h-5 bg-slate-200 rounded w-24 mb-6" />
      <div className="space-y-4">
        <div>
          <div className="h-3 bg-slate-200 rounded w-16 mb-2" />
          <div className="h-11 bg-slate-100 rounded-lg" />
        </div>
        <div>
          <div className="h-3 bg-slate-200 rounded w-20 mb-2" />
          <div className="h-11 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-11 bg-slate-200 rounded-lg w-20" />
      </div>
    </section>
  )
}

/** Password strength: 0=weak, 1=fair, 2=good, 3=strong */
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score: 1, label: '弱', color: '#EF4444' }
  if (score <= 2) return { score: 2, label: '普通', color: '#F59E0B' }
  if (score <= 3) return { score: 3, label: '良好', color: '#3B82F6' }
  return { score: 4, label: '強', color: '#10B981' }
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { score, label, color } = getPasswordStrength(password)
  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="h-1.5 flex-1 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: level <= score ? color : '#E2E8F0',
            }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color }}>
        密碼強度：{label}
      </p>
    </div>
  )
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case 'admin': return '管理員'
    case 'user': return '一般使用者'
    default: return role
  }
}

// ─── Section: Account Info ──────────────────────────────────────────────────

function AccountInfoCard({ profile }: { profile: UserProfile }) {
  return (
    <section className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: COLORS.white }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: COLORS.primary }}>
        帳號資訊
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="px-4 py-3 rounded-lg bg-slate-50">
          <p className="text-xs text-slate-500 mb-1">Email</p>
          <p className="text-sm font-medium" style={{ color: COLORS.primary }}>
            {profile.email}
          </p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-slate-50">
          <p className="text-xs text-slate-500 mb-1">角色</p>
          <p className="text-sm font-medium" style={{ color: COLORS.primary }}>
            <span
              className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: profile.role === 'admin' ? '#FEF3C7' : '#F1F5F9',
                color: profile.role === 'admin' ? '#92400E' : '#64748B',
              }}
            >
              {profile.role === 'admin' && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              )}
              {roleLabel(profile.role)}
            </span>
          </p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-slate-50">
          <p className="text-xs text-slate-500 mb-1">登入方式</p>
          <p className="text-sm font-medium" style={{ color: COLORS.primary }}>
            {profile.provider === 'discord' ? 'Discord' : '帳號密碼'}
          </p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-slate-50">
          <p className="text-xs text-slate-500 mb-1">加入日期</p>
          <p className="text-sm font-medium" style={{ color: COLORS.primary }}>
            {formatDate(profile.created_at)}
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Section: Profile Card ──────────────────────────────────────────────────

function ProfileCard({
  profile,
  onSaved,
}: {
  profile: UserProfile
  onSaved: () => void
}) {
  const [name, setName] = useState(profile.name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Sync when profile prop changes
  useEffect(() => {
    setName(profile.name ?? '')
    setAvatarUrl(profile.avatar_url ?? '')
  }, [profile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setFieldErrors({})

    // Client-side Zod validation
    const payload: Record<string, unknown> = {}
    if (name.trim()) payload.name = name.trim()
    if (avatarUrl.trim()) payload.avatar_url = avatarUrl.trim()

    // Only validate if there's something to send
    if (Object.keys(payload).length > 0) {
      const validation = validateData(updateProfileSchema, payload)
      if (!validation.success) {
        const errors: Record<string, string> = {}
        for (const err of validation.errors) {
          errors[err.path] = err.message
        }
        setFieldErrors(errors)
        return
      }
    }

    setSaving(true)

    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          avatar_url: avatarUrl.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '更新失敗' })
      } else {
        setMessage({ type: 'success', text: '個人資料已更新' })
        onSaved()
      }
    } catch {
      setMessage({ type: 'error', text: '連線失敗，請稍後再試' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: COLORS.white }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: COLORS.primary }}>
        個人資料
      </h2>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Avatar preview + name row */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {avatarUrl.trim() && isSafeAvatarUrl(avatarUrl.trim()) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt="頭像預覽"
                className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  target.nextElementSibling?.classList.remove('hidden')
                }}
              />
            ) : null}
            <div
              className={`w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center ${
                avatarUrl.trim() && isSafeAvatarUrl(avatarUrl.trim()) ? 'hidden' : ''
              }`}
            >
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            {/* Display Name */}
            <div>
              <label
                htmlFor="profile-name"
                className="block text-sm font-medium mb-1"
                style={{ color: COLORS.primary }}
              >
                顯示名稱
              </label>
              <input
                id="profile-name"
                type="text"
                placeholder="輸入你的名稱"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClassName}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                aria-invalid={!!fieldErrors.name}
              />
              <FieldError message={fieldErrors.name} />
            </div>

            {/* Email (read-only) */}
            <div>
              <label
                htmlFor="profile-email"
                className="block text-sm font-medium mb-1"
                style={{ color: COLORS.primary }}
              >
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={profile.email}
                disabled
                readOnly
                className={inputDisabledClassName}
                aria-label="Email（不可修改）"
              />
              <p className="mt-1 text-xs text-slate-400">Email 無法更改</p>
            </div>
          </div>
        </div>

        {/* Avatar URL */}
        <div>
          <label
            htmlFor="profile-avatar"
            className="block text-sm font-medium mb-1"
            style={{ color: COLORS.primary }}
          >
            頭像 URL
          </label>
          <input
            id="profile-avatar"
            type="text"
            placeholder="https://example.com/avatar.png"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className={inputClassName}
            aria-describedby={fieldErrors.avatar_url ? 'avatar-error' : undefined}
            aria-invalid={!!fieldErrors.avatar_url}
          />
          <FieldError message={fieldErrors.avatar_url} />
        </div>

        <button
          type="submit"
          disabled={saving}
          className={buttonPrimaryClassName}
          style={{ backgroundColor: COLORS.primary }}
        >
          {saving ? '儲存中...' : '儲存變更'}
        </button>

        {message && <AlertBanner type={message.type} message={message.text} />}
      </form>
    </section>
  )
}

// ─── Section: Change Password Card ─────────────────────────────────────────

function PasswordCard({ provider }: { provider: 'credentials' | 'discord' }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setFieldErrors({})

    // Client-side Zod validation
    const validation = validateData(changePasswordSchema, {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    })

    if (!validation.success) {
      const errors: Record<string, string> = {}
      for (const err of validation.errors) {
        errors[err.path] = err.message
      }
      setFieldErrors(errors)
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '更改密碼失敗' })
      } else {
        setMessage({ type: 'success', text: '密碼已更新成功' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch {
      setMessage({ type: 'error', text: '連線失敗，請稍後再試' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: COLORS.white }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: COLORS.primary }}>
        更改密碼
      </h2>

      {provider !== 'credentials' ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50 text-sm text-slate-500">
          <svg className="w-5 h-5 flex-shrink-0" fill="#5865F2" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          <span>你使用 Discord 登入，密碼由 Discord 管理</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-medium mb-1"
              style={{ color: COLORS.primary }}
            >
              目前密碼
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className={inputClassName}
              autoComplete="current-password"
              aria-describedby={fieldErrors.current_password ? 'current-pw-error' : undefined}
              aria-invalid={!!fieldErrors.current_password}
            />
            <FieldError message={fieldErrors.current_password} />
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium mb-1"
              style={{ color: COLORS.primary }}
            >
              新密碼
            </label>
            <input
              id="new-password"
              type="password"
              placeholder="至少 6 個字元"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className={inputClassName}
              autoComplete="new-password"
              aria-describedby={fieldErrors.new_password ? 'new-pw-error' : undefined}
              aria-invalid={!!fieldErrors.new_password}
            />
            <FieldError message={fieldErrors.new_password} />
            <PasswordStrengthBar password={newPassword} />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium mb-1"
              style={{ color: COLORS.primary }}
            >
              確認新密碼
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className={inputClassName}
              autoComplete="new-password"
              aria-describedby={fieldErrors.confirm_password ? 'confirm-pw-error' : undefined}
              aria-invalid={!!fieldErrors.confirm_password}
            />
            <FieldError message={fieldErrors.confirm_password} />
            {/* Inline match indicator */}
            {confirmPassword && newPassword && (
              <p className={`mt-1 text-xs ${confirmPassword === newPassword ? 'text-green-500' : 'text-red-500'}`}>
                {confirmPassword === newPassword ? '密碼一致' : '密碼不一致'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className={buttonPrimaryClassName}
            style={{ backgroundColor: COLORS.primary }}
          >
            {saving ? '更新中...' : '更改密碼'}
          </button>

          {message && <AlertBanner type={message.type} message={message.text} />}
        </form>
      )}
    </section>
  )
}

// ─── Section: Linked Accounts Card ──────────────────────────────────────────

function LinkedAccountsCard({ profile }: { profile: UserProfile }) {
  return (
    <section className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: COLORS.white }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: COLORS.primary }}>
        已連結帳號
      </h2>

      <div className="space-y-3">
        {/* Email account */}
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-slate-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
            <div>
              <p className="text-sm font-medium" style={{ color: COLORS.primary }}>
                Email 帳號
              </p>
              <p className="text-xs text-slate-500">{profile.email}</p>
            </div>
          </div>
          <span
            className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0"
            style={{ backgroundColor: '#dcfce7', color: '#166534' }}
          >
            已連結
          </span>
        </div>

        {/* Discord */}
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="#5865F2" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            <div>
              <p className="text-sm font-medium" style={{ color: COLORS.primary }}>
                Discord
              </p>
              {profile.discord_connected && (
                <p className="text-xs text-slate-500">已連結 Discord 帳號</p>
              )}
            </div>
          </div>
          {profile.discord_connected ? (
            <span
              className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0"
              style={{ backgroundColor: '#dcfce7', color: '#166534' }}
            >
              已連結
            </span>
          ) : (
            <span
              className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0"
              style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}
            >
              未連結
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── Section: Notification Preferences Card ─────────────────────────────────

function NotificationCard() {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    notify_assigned: true,
    notify_title_changed: false,
    notify_due_soon: true,
    notify_moved: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
  })
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function fetchPrefs() {
      try {
        const res = await fetch('/api/notifications/preferences')
        if (res.ok) {
          const data = await res.json()
          setPrefs(data)
        } else {
          setMessage({ type: 'error', text: '無法載入通知偏好，目前顯示預設值' })
        }
      } catch {
        setMessage({ type: 'error', text: '連線失敗，無法載入通知偏好' })
      } finally {
        setLoadingPrefs(false)
      }
    }
    fetchPrefs()
  }, [])

  const handleToggle = (key: keyof Pick<NotificationPreferences, 'notify_assigned' | 'notify_title_changed' | 'notify_due_soon' | 'notify_moved'>) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '更新失敗' })
      } else {
        const data = await res.json()
        setPrefs(data)
        setMessage({ type: 'success', text: '通知偏好已更新' })
      }
    } catch {
      setMessage({ type: 'error', text: '連線失敗，請稍後再試' })
    } finally {
      setSaving(false)
    }
  }

  const toggleOptions: { key: keyof Pick<NotificationPreferences, 'notify_assigned' | 'notify_title_changed' | 'notify_due_soon' | 'notify_moved'>; label: string; description: string }[] = [
    { key: 'notify_assigned', label: '被指派卡片', description: '當有人將卡片指派給你時通知' },
    { key: 'notify_title_changed', label: '標題變更', description: '你負責的卡片標題被修改時通知' },
    { key: 'notify_due_soon', label: '截止日期提醒', description: '卡片截止日期即將到來時通知' },
    { key: 'notify_moved', label: '卡片移動', description: '你負責的卡片被移到其他欄位時通知' },
  ]

  // Generate hours options 0-23
  const hoursOptions = Array.from({ length: 24 }, (_, i) => i)

  if (loadingPrefs) {
    return <SkeletonCard />
  }

  return (
    <section className="rounded-xl border shadow-sm p-6" style={{ backgroundColor: COLORS.white }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: COLORS.primary }}>
        通知偏好
      </h2>

      <div className="space-y-4">
        {/* Toggle switches */}
        {toggleOptions.map(({ key, label, description }) => (
          <div key={key} className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <span className="text-sm font-medium block" style={{ color: COLORS.primary }}>
                {label}
              </span>
              <span className="text-xs text-slate-400">{description}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[key]}
              aria-label={label}
              onClick={() => handleToggle(key)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${
                prefs[key] ? 'bg-green-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  prefs[key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}

        {/* Quiet hours */}
        <div className="border-t border-slate-200 pt-4 mt-4">
          <p className="text-sm font-medium mb-1" style={{ color: COLORS.primary }}>
            靜音時段
          </p>
          <p className="text-xs text-slate-400 mb-3">
            在此時段內不會收到通知
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label htmlFor="quiet-start" className="block text-xs text-slate-500 mb-1">
                開始時間
              </label>
              <select
                id="quiet-start"
                value={prefs.quiet_hours_start ?? ''}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    quiet_hours_start: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm bg-white"
              >
                <option value="">未設定</option>
                {hoursOptions.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <span className="text-slate-400 mt-5">~</span>
            <div className="flex-1">
              <label htmlFor="quiet-end" className="block text-xs text-slate-500 mb-1">
                結束時間
              </label>
              <select
                id="quiet-end"
                value={prefs.quiet_hours_end ?? ''}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    quiet_hours_end: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm bg-white"
              >
                <option value="">未設定</option>
                {hoursOptions.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={buttonPrimaryClassName}
          style={{ backgroundColor: COLORS.primary }}
        >
          {saving ? '儲存中...' : '儲存'}
        </button>

        {message && <AlertBanner type={message.type} message={message.text} />}
      </div>
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me')
      if (!res.ok) {
        if (res.status === 401) {
          setError('請先登入')
        } else {
          const data = await res.json()
          setError(data.error || '無法載入使用者資料')
        }
        return
      }
      const data: UserProfile = await res.json()
      setProfile(data)
      setError(null)
    } catch {
      setError('連線失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
      {/* Header */}
      <header
        className="border-b"
        style={{
          backgroundColor: COLORS.headerBg,
          borderColor: COLORS.headerBorder,
        }}
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm mb-4 hover:opacity-80 transition-opacity"
            style={{ color: COLORS.headerText, opacity: 0.7 }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回專案列表
          </Link>
          <h1
            className="text-2xl sm:text-3xl font-bold"
            style={{
              color: COLORS.headerText,
              letterSpacing: '-0.03em',
            }}
          >
            帳號設定
          </h1>
          <p
            className="mt-1 sm:mt-2 text-sm sm:text-base"
            style={{ color: COLORS.headerText, opacity: 0.7 }}
          >
            管理你的個人資料和偏好設定
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Loading state with skeletons */}
        {loading && (
          <div className="space-y-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 text-red-600 text-sm" role="alert">
            {error}
            {error === '請先登入' && (
              <Link
                href="/login"
                className="ml-2 underline hover:opacity-80"
              >
                前往登入
              </Link>
            )}
          </div>
        )}

        {/* Profile loaded */}
        {!loading && profile && (
          <>
            {/* 1. Account info */}
            <AccountInfoCard profile={profile} />

            {/* 2. Profile edit */}
            <ProfileCard profile={profile} onSaved={fetchProfile} />

            {/* 3. Change password (hidden for OAuth users) */}
            <PasswordCard provider={profile.provider} />

            {/* 4. Linked accounts */}
            <LinkedAccountsCard profile={profile} />

            {/* 5. Notification preferences */}
            <NotificationCard />
          </>
        )}
      </main>
    </div>
  )
}
