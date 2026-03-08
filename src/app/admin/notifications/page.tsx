'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchAdminNotificationSettings, fetchActiveUsers } from '@/lib/api'

// ========================================
// Types
// ========================================

interface NotificationSettings {
  boss_user_ids: string[]
  daily_digest_enabled: boolean
  digest_include_upcoming: boolean
  digest_include_overdue: boolean
  digest_include_yesterday_changes: boolean
  digest_include_project_stats: boolean
  digest_send_hour: number
}

interface BossUser {
  id: string
  name: string
  email: string
}

interface ActiveUser {
  id: string
  name: string | null
  email: string
}

interface SettingsResponse {
  settings: NotificationSettings
  boss_users: BossUser[]
}

// ========================================
// Constants
// ========================================

const DEFAULT_SETTINGS: NotificationSettings = {
  boss_user_ids: [],
  daily_digest_enabled: true,
  digest_include_upcoming: true,
  digest_include_overdue: true,
  digest_include_yesterday_changes: false,
  digest_include_project_stats: false,
  digest_send_hour: 9,
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

// ========================================
// Icons
// ========================================

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function BellAlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  )
}

// ========================================
// Toggle Switch Component
// ========================================

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
      className={`relative inline-flex h-6 w-11 items-center rounded-full border-none p-0 shrink-0 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${
        checked ? 'bg-blue-400' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[23px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
}

// ========================================
// Boss User Selector Component
// ========================================

function BossUserSelector({
  selectedIds,
  selectedUsers,
  allUsers,
  onChange,
  loading,
}: {
  selectedIds: string[]
  selectedUsers: BossUser[]
  allUsers: ActiveUser[]
  onChange: (ids: string[]) => void
  loading: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearchText('')
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setSearchText('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const filteredUsers = allUsers.filter((u) => {
    // Exclude already selected
    if (selectedIds.includes(u.id)) return false
    // Filter by search
    if (searchText) {
      const query = searchText.toLowerCase()
      const name = (u.name || '').toLowerCase()
      const email = u.email.toLowerCase()
      return name.includes(query) || email.includes(query)
    }
    return true
  })

  function handleSelect(userId: string) {
    onChange([...selectedIds, userId])
    setSearchText('')
    inputRef.current?.focus()
  }

  function handleRemove(userId: string) {
    onChange(selectedIds.filter((id) => id !== userId))
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Selected Tags + Input */}
      <div
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className={`flex flex-wrap gap-1.5 px-3 py-2 min-h-[44px] border rounded-lg bg-surface-elevated cursor-text items-center transition-colors duration-200 ${
          isOpen
            ? 'border-blue-400 ring-2 ring-blue-400/15'
            : 'border-border-default'
        }`}
      >
        {selectedUsers.map((user) => (
          <span
            key={user.id}
            className="inline-flex items-center gap-1 py-0.5 pl-2.5 pr-2 rounded-full bg-blue-50 text-blue-700 text-[13px] font-medium leading-5 dark:bg-blue-900/30 dark:text-blue-300"
          >
            {user.name || user.email}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove(user.id)
              }}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full border-none bg-transparent cursor-pointer p-0 text-blue-700 hover:bg-blue-200 dark:text-blue-300 dark:hover:bg-blue-800/50"
              aria-label={`移除 ${user.name || user.email}`}
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedUsers.length === 0 ? '搜尋並選擇使用者...' : ''}
          className="flex-1 min-w-[120px] border-none outline-none text-sm text-foreground bg-transparent py-0.5"
        />
        <ChevronDownIcon
          className="w-4 h-4 text-text-secondary"
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-elevated border border-border-default rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-text-secondary text-center">
              載入使用者中...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-4 py-3 text-sm text-text-secondary text-center">
              {searchText ? '沒有符合的使用者' : '沒有可選擇的使用者'}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user.id)}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 border-none bg-transparent cursor-pointer text-left text-sm text-foreground transition-colors duration-150 hover:bg-muted"
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-slate-400 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                    {user.name || '(未設定名稱)'}
                  </div>
                  <div className="text-xs text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
                    {user.email}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ========================================
// Section Card Wrapper
// ========================================

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface-elevated border border-border-default rounded-xl p-6">
      <h2 className={`text-base font-semibold text-brand-primary ${description ? 'mb-1' : 'mb-4'}`}>
        {title}
      </h2>
      {description && (
        <p className="text-[13px] text-text-secondary mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {children}
    </div>
  )
}

// ========================================
// Toggle Row Component
// ========================================

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5 gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && (
          <div className="text-xs text-text-secondary mt-0.5">{description}</div>
        )}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

// ========================================
// Main Page
// ========================================

export default function AdminNotificationsPage() {
  // Settings state
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [originalSettings, setOriginalSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [bossUsers, setBossUsers] = useState<BossUser[]>([])

  // Page state
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Manual trigger state
  const [triggerLoading, setTriggerLoading] = useState(false)

  // Fetch settings with TanStack Query
  const {
    data: settingsData,
    isLoading: loading,
    error: queryError,
    refetch: fetchSettings,
  } = useQuery({
    queryKey: queryKeys.admin.notifications.settings,
    queryFn: () => fetchAdminNotificationSettings() as Promise<SettingsResponse>,
  })

  const error = queryError instanceof Error ? queryError.message : null

  // Sync settings from query data
  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData.settings)
      setOriginalSettings(settingsData.settings)
      setBossUsers(settingsData.boss_users)
    }
  }, [settingsData])

  // Fetch active users with TanStack Query
  const {
    data: usersQueryData,
    isLoading: usersLoading,
  } = useQuery({
    queryKey: queryKeys.admin.notifications.users,
    queryFn: () => fetchActiveUsers() as Promise<{ users: ActiveUser[] }>,
  })

  const allUsers = usersQueryData?.users ?? []

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Dirty check
  const isDirty =
    JSON.stringify(settings) !== JSON.stringify(originalSettings)

  // Update boss_user_ids and sync bossUsers display list
  function handleBossChange(newIds: string[]) {
    setSettings((prev) => ({ ...prev, boss_user_ids: newIds }))

    // Build updated boss_users from allUsers + existing bossUsers
    const updatedBossUsers: BossUser[] = newIds.map((id) => {
      const existing = bossUsers.find((u) => u.id === id)
      if (existing) return existing
      const fromAll = allUsers.find((u) => u.id === id)
      if (fromAll) return { id: fromAll.id, name: fromAll.name || fromAll.email, email: fromAll.email }
      return { id, name: id, email: '' }
    })
    setBossUsers(updatedBossUsers)
  }

  // Update individual setting
  function updateSetting<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  // Save handler
  async function handleSave() {
    if (!isDirty || saving) return

    setSaving(true)
    try {
      const res = await fetch('/api/admin/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '儲存設定失敗')
      }

      const data: SettingsResponse = await res.json()
      setSettings(data.settings)
      setOriginalSettings(data.settings)
      setBossUsers(data.boss_users)

      setToast({ type: 'success', message: '通知設定已儲存' })
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : '儲存設定失敗' })
    } finally {
      setSaving(false)
    }
  }

  // Manual trigger handler
  async function handleTriggerDigest() {
    setTriggerLoading(true)
    try {
      const res = await fetch('/api/notifications/daily-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '發送失敗')
      }

      setToast({ type: 'success', message: '測試摘要已發送成功' })
    } catch (err) {
      const message = err instanceof Error ? err.message : '發送失敗'
      // If no CRON_SECRET or endpoint not configured, show friendly message
      if (message.includes('404') || message.includes('Not Found') || message.includes('Unauthorized')) {
        setToast({ type: 'error', message: '每日摘要功能尚未設定，請先完成相關 API 端點的建置' })
      } else {
        setToast({ type: 'error', message })
      }
    } finally {
      setTriggerLoading(false)
    }
  }

  // Format hour display
  function formatHour(hour: number): string {
    return `${hour.toString().padStart(2, '0')}:00`
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-balance text-brand-primary">通知管理</h1>
          <p className="text-sm text-text-secondary mt-1">
            管理每日摘要推播與通知偏好設定
          </p>
        </div>
        <div className="text-center py-12 text-text-secondary text-sm">
          <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          載入設定中...
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-balance text-brand-primary">通知管理</h1>
        </div>
        <div className="px-4 py-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50">
          {error}
        </div>
        <button
          onClick={() => fetchSettings()}
          className="mt-3 px-4 py-2 text-sm rounded-lg border border-border-default bg-surface-elevated text-foreground cursor-pointer hover:bg-muted transition-colors"
        >
          重試
        </button>
      </div>
    )
  }

  return (
    <div id="main-content" className="p-6 max-w-[960px]">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-balance text-brand-primary">
          通知管理
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          管理每日摘要推播與通知偏好設定
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/50'
              : 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50'
          }`}
        >
          <span>{toast.type === 'success' ? '\u2713' : '\u2717'}</span>
          {toast.message}
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-5">
        {/* Section 1: Boss Users */}
        <SectionCard
          title="老闆名單"
          description="被指定為老闆的使用者可收到所有團隊成員的每日摘要，即使未被指派到該專案。"
        >
          <BossUserSelector
            selectedIds={settings.boss_user_ids}
            selectedUsers={bossUsers}
            allUsers={allUsers}
            onChange={handleBossChange}
            loading={usersLoading}
          />
          {settings.boss_user_ids.length > 0 && (
            <div className="mt-2 text-xs text-text-secondary">
              已選擇 {settings.boss_user_ids.length} 位老闆
            </div>
          )}
        </SectionCard>

        {/* Section 2: Digest Content Settings */}
        <SectionCard
          title="每日摘要內容"
          description="設定每日摘要包含哪些資訊區塊，以及推播時間。"
        >
          {/* Master Toggle */}
          <div
            className={`flex items-center justify-between px-4 py-3.5 rounded-lg mb-2 gap-4 border ${
              settings.daily_digest_enabled
                ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/50'
                : 'bg-muted border-border-default'
            }`}
          >
            <div>
              <div className="text-sm font-semibold text-brand-primary">
                啟用每日摘要
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                開啟後系統將於指定時間自動推播每日摘要給相關使用者
              </div>
            </div>
            <ToggleSwitch
              checked={settings.daily_digest_enabled}
              onChange={(v) => updateSetting('daily_digest_enabled', v)}
            />
          </div>

          {/* Content toggles */}
          <div
            className={`transition-opacity duration-200 ${
              settings.daily_digest_enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'
            }`}
          >
            <ToggleRow
              label="即將到期提醒"
              description="列出未來 3 天內即將到期的任務"
              checked={settings.digest_include_upcoming}
              onChange={(v) => updateSetting('digest_include_upcoming', v)}
              disabled={!settings.daily_digest_enabled}
            />
            <ToggleRow
              label="逾期警告"
              description="列出所有已超過截止日期但尚未完成的任務"
              checked={settings.digest_include_overdue}
              onChange={(v) => updateSetting('digest_include_overdue', v)}
              disabled={!settings.daily_digest_enabled}
            />
            <ToggleRow
              label="昨日變更摘要"
              description="統計昨天新增、完成、移動的卡片數量"
              checked={settings.digest_include_yesterday_changes}
              onChange={(v) => updateSetting('digest_include_yesterday_changes', v)}
              disabled={!settings.daily_digest_enabled}
            />
            <ToggleRow
              label="專案進度統計"
              description="顯示各專案的欄位分佈與完成百分比"
              checked={settings.digest_include_project_stats}
              onChange={(v) => updateSetting('digest_include_project_stats', v)}
              disabled={!settings.daily_digest_enabled}
            />

            {/* Send Hour */}
            <div className="flex items-center justify-between py-3.5 gap-4">
              <div>
                <div className="text-sm font-medium text-foreground">推播時間</div>
                <div className="text-xs text-text-secondary mt-0.5">
                  每天於指定時間發送摘要（台灣時間 UTC+8）
                </div>
              </div>
              <div className="relative">
                <select
                  value={settings.digest_send_hour}
                  onChange={(e) => updateSetting('digest_send_hour', parseInt(e.target.value, 10))}
                  disabled={!settings.daily_digest_enabled}
                  className={`py-2 pl-3 pr-8 text-sm border border-border-default rounded-lg bg-surface-elevated text-foreground appearance-none min-w-[100px] outline-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400/15 ${
                    settings.daily_digest_enabled ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Section 3: Manual Trigger */}
        <SectionCard
          title="手動觸發"
          description="立即發送一次測試摘要，確認推播內容與格式是否正確。"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <BellAlertIcon className="w-5 h-5 text-text-secondary" />
              <span className="text-sm text-foreground">
                手動發送一次每日摘要
              </span>
            </div>
            <button
              type="button"
              onClick={handleTriggerDigest}
              disabled={triggerLoading}
              className={`px-5 py-2.5 text-sm font-medium rounded-lg border border-border-default bg-surface-elevated text-foreground transition-colors duration-150 flex items-center gap-1.5 ${
                triggerLoading
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:bg-muted hover:border-gray-300 dark:hover:border-white/20'
              }`}
            >
              {triggerLoading ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  發送中...
                </>
              ) : (
                '發送測試摘要'
              )}
            </button>
          </div>
        </SectionCard>
      </div>

      {/* Save Button Bar */}
      <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-border-default">
        {isDirty && (
          <span className="text-[13px] text-text-secondary mr-auto">
            有未儲存的變更
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setSettings(originalSettings)
            // Restore boss users from original
            const restoredBossUsers = originalSettings.boss_user_ids.map((id) => {
              const existing = bossUsers.find((u) => u.id === id)
              if (existing) return existing
              const fromAll = allUsers.find((u) => u.id === id)
              if (fromAll) return { id: fromAll.id, name: fromAll.name || fromAll.email, email: fromAll.email }
              return { id, name: id, email: '' }
            })
            setBossUsers(restoredBossUsers)
          }}
          disabled={!isDirty || saving}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg border border-border-default bg-surface-elevated text-foreground transition-colors duration-150 ${
            !isDirty || saving
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:bg-muted'
          }`}
        >
          重設
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`px-6 py-2.5 text-sm font-semibold rounded-lg border-none text-white transition-colors duration-150 flex items-center gap-1.5 ${
            isDirty && !saving
              ? 'bg-blue-400 cursor-pointer hover:bg-blue-500'
              : 'bg-blue-300 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              儲存中...
            </>
          ) : (
            '儲存設定'
          )}
        </button>
      </div>
    </div>
  )
}
