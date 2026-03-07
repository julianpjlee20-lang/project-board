'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ========================================
// Types
// ========================================

interface UserDetail {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
  role: 'admin' | 'user'
  is_active: boolean
  login_method: 'credentials' | 'discord' | 'both'
  discord_user_id: string | null
  created_at: string
  updated_at: string | null
  stats: {
    project_count: number
    assigned_card_count: number
  }
}

// ========================================
// Icons (inline SVG)
// ========================================

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  )
}

// ========================================
// Helper Components
// ========================================

function LargeAvatar({ user }: { user: UserDetail }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name || user.email}
        className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
      />
    )
  }

  const initial = (user.name || user.email || '?')[0].toUpperCase()
  return (
    <div
      className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white border-2 border-slate-200 bg-slate-400"
    >
      {initial}
    </div>
  )
}

function ProviderBadge({ method }: { method: UserDetail['login_method'] }) {
  const configs: Record<string, { label: string; className: string }> = {
    credentials: { label: '帳號密碼', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    discord: { label: 'Discord', className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
    both: { label: '帳密 + Discord', className: 'bg-fuchsia-50 text-violet-600 dark:bg-fuchsia-900/30 dark:text-violet-400' },
  }
  const config = configs[method] || configs.credentials

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3 text-center">
      <div className="text-2xl font-bold text-brand-primary">
        {value}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</div>
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-emerald-500' : 'bg-gray-300'}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ========================================
// Main Page
// ========================================

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Editable form state
  const [formName, setFormName] = useState('')
  const [formRole, setFormRole] = useState<'admin' | 'user'>('user')
  const [formActive, setFormActive] = useState(true)

  // Save state
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Reset password state
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [resetShowPassword, setResetShowPassword] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)

  // Reset link state
  const [resetLink, setResetLink] = useState<string | null>(null)
  const [resetLinkLoading, setResetLinkLoading] = useState(false)
  const [resetLinkCopied, setResetLinkCopied] = useState(false)

  // Track original values for dirty check
  const [originalValues, setOriginalValues] = useState({
    name: '',
    role: 'user' as 'admin' | 'user',
    is_active: true,
  })

  // Fetch user detail
  useEffect(() => {
    async function fetchUser() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          credentials: 'include',
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || '載入使用者資料失敗')
        }

        const data: UserDetail = await res.json()
        setUser(data)

        // Populate form
        const name = data.name || ''
        setFormName(name)
        setFormRole(data.role)
        setFormActive(data.is_active)
        setOriginalValues({
          name,
          role: data.role,
          is_active: data.is_active,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : '載入失敗')
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [userId])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Dirty check
  const isDirty =
    formName !== originalValues.name ||
    formRole !== originalValues.role ||
    formActive !== originalValues.is_active

  // Save handler
  async function handleSave() {
    if (!isDirty || saving) return

    // 前端驗證：名稱若有填寫則不可為空字串
    if (formName !== originalValues.name && formName.trim() === '' && originalValues.name !== '') {
      setToast({ type: 'error', message: '顯示名稱不可為空白，若要清除請保持原始值' })
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {}

      if (formName !== originalValues.name) {
        // 傳空字串時，API 的 z.string().min(1) 會拒絕，改為不傳（保留原值）
        if (formName.trim().length > 0) {
          body.name = formName.trim()
        }
      }
      if (formRole !== originalValues.role) {
        body.role = formRole
      }
      if (formActive !== originalValues.is_active) {
        body.is_active = formActive
      }

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '儲存失敗')
      }

      // 型別聲明確保 PATCH 回應欄位安全存取
      const updatedUser = await res.json() as {
        id: string
        name: string | null
        email: string
        avatar_url: string | null
        role: 'admin' | 'user'
        is_active: boolean
        created_at: string
        updated_at: string | null
      }

      // Update local state
      setUser((prev) =>
        prev
          ? {
              ...prev,
              name: updatedUser.name,
              role: updatedUser.role,
              is_active: updatedUser.is_active,
              updated_at: updatedUser.updated_at,
            }
          : prev
      )

      const newName = updatedUser.name || ''
      setFormName(newName)
      setFormRole(updatedUser.role)
      setFormActive(updatedUser.is_active)
      setOriginalValues({
        name: newName,
        role: updatedUser.role,
        is_active: updatedUser.is_active,
      })

      setToast({ type: 'success', message: '使用者資料已更新' })
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : '儲存失敗' })
    } finally {
      setSaving(false)
    }
  }

  // Reset link handlers
  const handleGenerateResetLink = async () => {
    setResetLinkLoading(true)
    setResetLink(null)
    try {
      const res = await fetch(`/api/admin/users/${user?.id}/generate-reset-link`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok) {
        setResetLink(data.resetUrl)
      } else {
        setResetError(data.error || '產生連結失敗')
      }
    } catch {
      setResetError('產生連結時發生錯誤')
    } finally {
      setResetLinkLoading(false)
    }
  }

  const handleCopyResetLink = async () => {
    if (!resetLink) return
    try {
      await navigator.clipboard.writeText(resetLink)
      setResetLinkCopied(true)
      setTimeout(() => setResetLinkCopied(false), 2000)
    } catch {
      // fallback
      const textarea = document.createElement('textarea')
      textarea.value = resetLink
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setResetLinkCopied(true)
      setTimeout(() => setResetLinkCopied(false), 2000)
    }
  }

  // Reset password handlers
  function handleGenerateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
    const arr = new Uint8Array(12)
    crypto.getRandomValues(arr)
    const password = Array.from(arr, b => chars[b % chars.length]).join('')
    setResetNewPassword(password)
    setResetConfirmPassword(password)
    setResetShowPassword(true)
    setResetError(null)
  }

  async function handleResetPassword() {
    if (!resetNewPassword) {
      setResetError('請輸入新密碼')
      return
    }

    if (resetNewPassword.length < 6) {
      setResetError('密碼長度至少 6 個字元')
      return
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('兩次密碼輸入不一致')
      return
    }

    setResetLoading(true)
    setResetError(null)

    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_password: resetNewPassword }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '重設密碼失敗')
      }

      setToast({ type: 'success', message: '密碼已重設成功' })
      setResetNewPassword('')
      setResetConfirmPassword('')
      setResetShowPassword(false)
    } catch (err) {
      setResetError(err instanceof Error ? err.message : '重設密碼失敗')
    } finally {
      setResetLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/admin/users"
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            返回使用者列表
          </Link>
        </div>
        <div className="text-slate-400">載入中…</div>
      </div>
    )
  }

  // Error state
  if (error || !user) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/admin/users"
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            返回使用者列表
          </Link>
        </div>
        <div className="px-4 py-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
          {error || '使用者不存在'}
        </div>
      </div>
    )
  }

  return (
    <div id="main-content" className="p-6 max-w-3xl">
      {/* Back Button */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/users"
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          返回使用者列表
        </Link>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* User Info Card */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 p-6 mb-6">
        <div className="flex items-start gap-5">
          <LargeAvatar user={user} />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-brand-primary">
              {user.name || '(未設定名稱)'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>

            <div className="flex items-center flex-wrap gap-2 mt-3">
              <ProviderBadge method={user.login_method} />
              {user.discord_user_id && (
                <span className="text-xs text-slate-400">
                  Discord ID: {user.discord_user_id}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
              <span>
                建立時間：{new Date(user.created_at).toLocaleString('zh-TW')}
              </span>
              {user.updated_at && (
                <span>
                  最後更新：{new Date(user.updated_at).toLocaleString('zh-TW')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <StatCard label="建立的專案" value={user.stats.project_count} />
          <StatCard label="被指派的任務" value={user.stats.assigned_card_count} />
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4 text-brand-primary">
          編輯使用者
        </h2>

        <div className="space-y-5">
          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              顯示名稱
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="輸入顯示名稱"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 text-sm dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              角色
            </label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as 'admin' | 'user')}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 text-sm dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="user">一般使用者</option>
              <option value="admin">管理員</option>
            </select>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                帳號狀態
              </label>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {formActive ? '帳號已啟用，使用者可正常登入' : '帳號已停用，使用者無法登入'}
              </p>
            </div>
            <ToggleSwitch
              checked={formActive}
              onChange={setFormActive}
            />
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/admin/users')}
              className="px-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="px-6 py-2.5 text-sm rounded-lg text-white font-medium transition-opacity disabled:opacity-50 bg-brand-primary"
            >
              {saving ? '儲存中...' : '儲存變更'}
            </button>
          </div>
        </div>
      </div>

      {/* Reset Password Section */}
      {(user.login_method === 'credentials' || user.login_method === 'both') && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 p-6 mt-6">
          <h2 className="text-lg font-semibold mb-1 text-brand-primary">
            重設密碼
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            為此使用者設定新密碼，使用者下次登入時需使用新密碼
          </p>

          {/* ─── 方式一：產生重設連結 ─── */}
          <div className="mb-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              方式一：產生重設連結
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              產生一次性連結，複製後透過 Discord / LINE 傳給使用者，讓使用者自行設定新密碼（60 分鐘有效）
            </p>

            {resetLink ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={resetLink}
                    readOnly
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopyResetLink}
                    className={`shrink-0 px-4 py-2 text-sm rounded-lg font-medium text-white dark:text-slate-100 transition-colors ${resetLinkCopied ? 'bg-emerald-500' : 'bg-brand-primary'}`}
                  >
                    {resetLinkCopied ? '已複製 ✓' : '複製'}
                  </button>
                </div>
                <p className="text-xs text-amber-600">此連結 60 分鐘後失效，且只能使用一次</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateResetLink}
                disabled={resetLinkLoading}
                className="px-4 py-2 text-sm rounded-lg font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:opacity-50 dark:bg-slate-800"
              >
                {resetLinkLoading ? '產生中...' : '產生重設連結'}
              </button>
            )}
          </div>

          {/* ─── 方式二：直接設定新密碼 ─── */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              方式二：直接設定新密碼
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              由管理員直接為使用者設定密碼，使用者登入後會被要求更改
            </p>

            <div className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  新密碼
                </label>
                <div className="relative">
                  <input
                    type={resetShowPassword ? 'text' : 'password'}
                    value={resetNewPassword}
                    onChange={(e) => {
                      setResetNewPassword(e.target.value)
                      setResetError(null)
                    }}
                    placeholder="輸入新密碼"
                    className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 text-sm dark:bg-slate-800 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setResetShowPassword(!resetShowPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={resetShowPassword ? '隱藏密碼' : '顯示密碼'}
                  >
                    {resetShowPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  確認密碼
                </label>
                <input
                  type={resetShowPassword ? 'text' : 'password'}
                  value={resetConfirmPassword}
                  onChange={(e) => {
                    setResetConfirmPassword(e.target.value)
                    setResetError(null)
                  }}
                  placeholder="再次輸入新密碼"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 text-sm dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Generate Random Password */}
              <button
                type="button"
                onClick={handleGenerateRandomPassword}
                className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 underline underline-offset-2 transition-colors"
              >
                產生隨機密碼
              </button>

              {/* Error */}
              {resetError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
                  {resetError}
                </div>
              )}

              {/* Submit */}
              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetLoading || !resetNewPassword}
                  className="px-6 py-2.5 text-sm rounded-lg font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  {resetLoading ? '處理中...' : '確認重設密碼'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
