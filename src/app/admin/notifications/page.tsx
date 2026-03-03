'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

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

function BellAlertIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
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
      style={{
        position: 'relative',
        display: 'inline-flex',
        height: '24px',
        width: '44px',
        alignItems: 'center',
        borderRadius: '12px',
        border: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: checked ? '#4EA7FC' : '#D1D5DB',
        transition: 'background-color 200ms ease',
        opacity: disabled ? 0.5 : 1,
        outline: 'none',
        flexShrink: 0,
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 2px #fff, 0 0 0 4px #4EA7FC'
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <span
        style={{
          display: 'inline-block',
          height: '18px',
          width: '18px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          transition: 'transform 200ms ease',
          transform: checked ? 'translateX(23px)' : 'translateX(3px)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
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
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Selected Tags + Input */}
      <div
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '8px 12px',
          minHeight: '44px',
          border: '1px solid #E5E5E5',
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          cursor: 'text',
          alignItems: 'center',
          transition: 'border-color 200ms',
          borderColor: isOpen ? '#4EA7FC' : '#E5E5E5',
          boxShadow: isOpen ? '0 0 0 2px rgba(78, 167, 252, 0.15)' : 'none',
        }}
      >
        {selectedUsers.map((user) => (
          <span
            key={user.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px 2px 10px',
              borderRadius: '16px',
              backgroundColor: '#EEF6FF',
              color: '#1D4ED8',
              fontSize: '13px',
              fontWeight: 500,
              lineHeight: '20px',
            }}
          >
            {user.name || user.email}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove(user.id)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                padding: 0,
                color: '#1D4ED8',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#DBEAFE'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
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
          style={{
            flex: 1,
            minWidth: '120px',
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            color: '#374151',
            backgroundColor: 'transparent',
            padding: '2px 0',
          }}
        />
        <ChevronDownIcon
          className="w-4 h-4"
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E5E5',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 50,
            maxHeight: '240px',
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div style={{ padding: '12px 16px', fontSize: '14px', color: '#6B7280', textAlign: 'center' }}>
              載入使用者中...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: '14px', color: '#6B7280', textAlign: 'center' }}>
              {searchText ? '沒有符合的使用者' : '沒有可選擇的使用者'}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: '#374151',
                  transition: 'background-color 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name || '(未設定名稱)'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E5E5',
        borderRadius: '12px',
        padding: '24px',
      }}
    >
      <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0B1A14', marginBottom: description ? '4px' : '16px' }}>
        {title}
      </h2>
      {description && (
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px', lineHeight: '1.5' }}>
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid #F3F4F6',
        gap: '16px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>{label}</div>
        {description && (
          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{description}</div>
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

  // All active users for selector
  const [allUsers, setAllUsers] = useState<ActiveUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  // Page state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Manual trigger state
  const [triggerLoading, setTriggerLoading] = useState(false)

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/notifications/settings', {
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '載入通知設定失敗')
      }

      const data: SettingsResponse = await res.json()
      setSettings(data.settings)
      setOriginalSettings(data.settings)
      setBossUsers(data.boss_users)
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入通知設定失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch active users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)

    try {
      const res = await fetch('/api/admin/users?is_active=true&limit=100', {
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('載入使用者列表失敗')
      }

      const data = await res.json()
      setAllUsers(data.users || [])
    } catch {
      // Silently handle - user list is non-critical
      setAllUsers([])
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
    fetchUsers()
  }, [fetchSettings, fetchUsers])

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
        setToast({ type: 'error', message: '每日摘要 API 尚未設定，請先完成 /api/notifications/daily-digest 端點' })
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
      <div style={{ padding: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0B1A14' }}>通知管理</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
            管理每日摘要推播與通知偏好設定
          </p>
        </div>
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#6B7280', fontSize: '14px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '2px solid #0B1A14',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          載入設定中...
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0B1A14' }}>通知管理</h1>
        </div>
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#FEF2F2',
            color: '#DC2626',
            fontSize: '14px',
            border: '1px solid #FECACA',
          }}
        >
          {error}
        </div>
        <button
          onClick={fetchSettings}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            fontSize: '14px',
            borderRadius: '8px',
            border: '1px solid #E5E5E5',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            cursor: 'pointer',
          }}
        >
          重試
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '960px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0B1A14' }}>
          通知管理
        </h1>
        <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
          管理每日摘要推播與通知偏好設定
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: toast.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            color: toast.type === 'success' ? '#15803D' : '#DC2626',
            border: `1px solid ${toast.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>{toast.type === 'success' ? '\u2713' : '\u2717'}</span>
          {toast.message}
        </div>
      )}

      {/* Content Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '20px',
        }}
      >
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
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#6B7280' }}>
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
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: '8px',
              backgroundColor: settings.daily_digest_enabled ? '#EEF6FF' : '#F9FAFB',
              border: `1px solid ${settings.daily_digest_enabled ? '#BFDBFE' : '#E5E5E5'}`,
              marginBottom: '8px',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0B1A14' }}>
                啟用每日摘要
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
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
            style={{
              opacity: settings.daily_digest_enabled ? 1 : 0.5,
              pointerEvents: settings.daily_digest_enabled ? 'auto' : 'none',
              transition: 'opacity 200ms',
            }}
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 0',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>推播時間</div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                  每天於指定時間發送摘要（台灣時間 UTC+8）
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <select
                  value={settings.digest_send_hour}
                  onChange={(e) => updateSetting('digest_send_hour', parseInt(e.target.value, 10))}
                  disabled={!settings.daily_digest_enabled}
                  style={{
                    padding: '8px 32px 8px 12px',
                    fontSize: '14px',
                    border: '1px solid #E5E5E5',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    color: '#374151',
                    cursor: settings.daily_digest_enabled ? 'pointer' : 'not-allowed',
                    appearance: 'none',
                    minWidth: '100px',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4EA7FC'
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(78, 167, 252, 0.15)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E5E5'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon
                  className="w-4 h-4"
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BellAlertIcon className="w-5 h-5" style={{ color: '#6B7280' }} />
              <span style={{ fontSize: '14px', color: '#374151' }}>
                手動發送一次每日摘要
              </span>
            </div>
            <button
              type="button"
              onClick={handleTriggerDigest}
              disabled={triggerLoading}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '8px',
                border: '1px solid #E5E5E5',
                backgroundColor: '#FFFFFF',
                color: '#374151',
                cursor: triggerLoading ? 'not-allowed' : 'pointer',
                opacity: triggerLoading ? 0.6 : 1,
                transition: 'all 150ms',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseEnter={(e) => {
                if (!triggerLoading) {
                  e.currentTarget.style.backgroundColor = '#F9FAFB'
                  e.currentTarget.style.borderColor = '#D1D5DB'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF'
                e.currentTarget.style.borderColor = '#E5E5E5'
              }}
            >
              {triggerLoading ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      border: '2px solid #9CA3AF',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid #E5E5E5',
        }}
      >
        {isDirty && (
          <span style={{ fontSize: '13px', color: '#6B7280', marginRight: 'auto' }}>
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
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '8px',
            border: '1px solid #E5E5E5',
            backgroundColor: '#FFFFFF',
            color: '#374151',
            cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
            opacity: !isDirty || saving ? 0.5 : 1,
            transition: 'all 150ms',
          }}
          onMouseEnter={(e) => {
            if (isDirty && !saving) {
              e.currentTarget.style.backgroundColor = '#F9FAFB'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF'
          }}
        >
          重設
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            backgroundColor: isDirty && !saving ? '#4EA7FC' : '#93C5FD',
            color: '#FFFFFF',
            cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
            transition: 'all 150ms',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
          onMouseEnter={(e) => {
            if (isDirty && !saving) {
              e.currentTarget.style.backgroundColor = '#3B95EA'
            }
          }}
          onMouseLeave={(e) => {
            if (isDirty && !saving) {
              e.currentTarget.style.backgroundColor = '#4EA7FC'
            } else {
              e.currentTarget.style.backgroundColor = '#93C5FD'
            }
          }}
        >
          {saving ? (
            <>
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#FFFFFF',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              儲存中...
            </>
          ) : (
            '儲存設定'
          )}
        </button>
      </div>

      {/* Spinner animation keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
