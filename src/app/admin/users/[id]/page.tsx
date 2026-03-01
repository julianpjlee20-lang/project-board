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
      className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white border-2 border-slate-200"
      style={{ backgroundColor: '#94A3B8' }}
    >
      {initial}
    </div>
  )
}

function ProviderBadge({ method }: { method: UserDetail['login_method'] }) {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    credentials: { label: '帳號密碼', bg: '#F1F5F9', text: '#475569' },
    discord: { label: 'Discord', bg: '#EEF2FF', text: '#5865F2' },
    both: { label: '帳密 + Discord', bg: '#FDF4FF', text: '#7C3AED' },
  }
  const config = configs[method] || configs.credentials

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 rounded-lg px-4 py-3 text-center">
      <div className="text-2xl font-bold" style={{ color: '#0B1A14' }}>
        {value}
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{ backgroundColor: checked ? '#10B981' : '#D1D5DB' }}
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

  // Loading state
  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/admin/users"
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            返回使用者列表
          </Link>
        </div>
        <div className="text-slate-400">載入中...</div>
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
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
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
    <div className="p-6 max-w-3xl">
      {/* Back Button */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/users"
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
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
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-start gap-5">
          <LargeAvatar user={user} />
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: '#0B1A14' }}>
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
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#0B1A14' }}>
          編輯使用者
        </h2>

        <div className="space-y-5">
          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              顯示名稱
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="輸入顯示名稱"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              角色
            </label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as 'admin' | 'user')}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
            >
              <option value="user">一般使用者</option>
              <option value="admin">管理員</option>
            </select>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                帳號狀態
              </label>
              <p className="text-xs text-slate-400 mt-0.5">
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
              className="px-4 py-2.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="px-6 py-2.5 text-sm rounded-lg text-white font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#0B1A14' }}
            >
              {saving ? '儲存中...' : '儲存變更'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
