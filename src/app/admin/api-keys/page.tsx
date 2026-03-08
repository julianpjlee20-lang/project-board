'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { queryKeys } from '@/lib/query-keys'
import { fetchAdminApiKeys } from '@/lib/api'

// ========================================
// Types
// ========================================

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  permissions: 'full' | 'read_only'
  is_active: boolean
  expires_at: string | null
  created_at: string
  last_used_at: string | null
  owner_name?: string
  owner_email?: string
}

interface CreateKeyPayload {
  name: string
  permissions: 'full' | 'read_only'
  expires_at?: string
}

// ========================================
// Sort Types & Helper
// ========================================

type SortDirection = 'asc' | 'desc' | null
type ApiKeySortKey = 'name' | 'key_prefix' | 'permissions' | 'status' | 'created_at' | 'last_used_at' | 'expires_at'

interface SortState {
  key: ApiKeySortKey | null
  direction: SortDirection
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
}: {
  label: string
  sortKey: ApiKeySortKey
  currentSort: SortState
  onSort: (key: ApiKeySortKey) => void
}) {
  const isActive = currentSort.key === sortKey
  const direction = isActive ? currentSort.direction : null

  return (
    <th
      className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 select-none cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-500"
      tabIndex={0}
      role="button"
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(sortKey); } }}
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-xs ${isActive ? 'text-blue-500' : 'text-slate-400 opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '▲▼'}
        </span>
      </span>
    </th>
  )
}

// ========================================
// Helper Components
// ========================================

function PermissionBadge({ permissions }: { permissions: ApiKey['permissions'] }) {
  if (permissions === 'full') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        完整權限
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
      唯讀
    </span>
  )
}

function StatusBadge({ isActive, expiresAt }: { isActive: boolean; expiresAt: string | null }) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        已撤銷
      </span>
    )
  }

  if (expiresAt && new Date(expiresAt) < new Date()) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        已過期
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      啟用中
    </span>
  )
}

function KeyPrefixDisplay({ prefix }: { prefix: string }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-200">
      {prefix}...
    </code>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
    </svg>
  )
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  )
}

// ========================================
// Main Component
// ========================================

export default function ApiKeysPage() {
  const queryClient = useQueryClient()

  // TanStack Query for key list
  const {
    data: keysData,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.admin.apiKeys.list(),
    queryFn: () => fetchAdminApiKeys() as Promise<{ keys: ApiKey[] }>,
  })

  const keys = keysData?.keys ?? []
  const error = queryError instanceof Error ? queryError.message : null

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPermissions, setCreatePermissions] = useState<'full' | 'read_only'>('full')
  const [createExpiresAt, setCreateExpiresAt] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Success modal state (show plaintext key once)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [newKeyPlaintext, setNewKeyPlaintext] = useState('')
  const [newKeyName, setNewKeyName] = useState('')
  const [copied, setCopied] = useState(false)

  // Revoke confirmation state
  const [pendingRevoke, setPendingRevoke] = useState<ApiKey | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)

  // Delete confirmation state
  const [pendingDelete, setPendingDelete] = useState<ApiKey | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Sort state
  const [sort, setSort] = useState<SortState>({ key: null, direction: null })

  const handleSort = useCallback((key: ApiKeySortKey) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' }
      if (prev.direction === 'asc') return { key, direction: 'desc' }
      return { key: null, direction: null }
    })
  }, [])

  const invalidateKeys = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.apiKeys.all })
  }, [queryClient])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // ========================================
  // Create Key
  // ========================================

  function handleOpenCreate() {
    setCreateName('')
    setCreatePermissions('full')
    setCreateExpiresAt('')
    setCreateError(null)
    setShowCreateModal(true)
  }

  async function handleCreateKey() {
    if (!createName.trim()) {
      setCreateError('請輸入 Key 名稱')
      return
    }

    setCreateLoading(true)
    setCreateError(null)

    try {
      const payload: CreateKeyPayload = {
        name: createName.trim(),
        permissions: createPermissions,
      }

      if (createExpiresAt) {
        payload.expires_at = createExpiresAt
      }

      const res = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '建立 API Key 失敗')
      }

      const data = await res.json()

      // Close create modal
      setShowCreateModal(false)

      // Show success modal with plaintext key
      setNewKeyPlaintext(data.api_key)
      setNewKeyName(data.key?.name || createName)
      setCopied(false)
      setShowSuccessModal(true)

      // Refresh key list
      invalidateKeys()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '建立 API Key 失敗')
    } finally {
      setCreateLoading(false)
    }
  }

  // ========================================
  // Copy Key
  // ========================================

  async function handleCopyKey() {
    try {
      await navigator.clipboard.writeText(newKeyPlaintext)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text
      const textarea = document.createElement('textarea')
      textarea.value = newKeyPlaintext
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ========================================
  // Revoke Key
  // ========================================

  async function handleRevokeConfirmed() {
    if (!pendingRevoke) return

    setRevokeLoading(true)

    try {
      const res = await fetch('/api/ai/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key_id: pendingRevoke.id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '撤銷 API Key 失敗')
      }

      setToast({ type: 'success', message: `已撤銷 API Key「${pendingRevoke.name}」` })
      setPendingRevoke(null)

      // Refresh key list
      invalidateKeys()
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : '撤銷 API Key 失敗' })
      setPendingRevoke(null)
    } finally {
      setRevokeLoading(false)
    }
  }

  // ========================================
  // Delete Key (hard delete)
  // ========================================

  async function handleDeleteConfirmed() {
    if (!pendingDelete) return

    setDeleteLoading(true)

    try {
      const res = await fetch('/api/ai/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key_id: pendingDelete.id, action: 'delete' }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '刪除 API Key 失敗')
      }

      setToast({ type: 'success', message: `已永久刪除 API Key「${pendingDelete.name}」` })
      setPendingDelete(null)

      invalidateKeys()
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : '刪除 API Key 失敗' })
      setPendingDelete(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  // ========================================
  // Helpers
  // ========================================

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Active and revoked counts
  const activeCount = keys.filter((k) => k.is_active).length
  const revokedCount = keys.filter((k) => !k.is_active).length

  // Sorted keys
  const sortedKeys = useMemo(() => {
    if (!sort.key || !sort.direction) return keys

    function getStatusLabel(k: ApiKey): string {
      if (!k.is_active) return '已撤銷'
      if (k.expires_at && new Date(k.expires_at) < new Date()) return '已過期'
      return '啟用中'
    }

    const sorted = [...keys].sort((a, b) => {
      const key = sort.key!
      let comparison = 0

      if (key === 'status') {
        comparison = getStatusLabel(a).localeCompare(getStatusLabel(b), 'zh-TW')
      } else if (key === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (key === 'last_used_at' || key === 'expires_at') {
        // null 值排最後
        const valA = a[key] ? new Date(a[key]!).getTime() : null
        const valB = b[key] ? new Date(b[key]!).getTime() : null
        if (valA === null && valB === null) comparison = 0
        else if (valA === null) comparison = 1
        else if (valB === null) comparison = -1
        else comparison = valA - valB
      } else {
        // 字串排序：name, key_prefix, permissions
        const valA = (a[key] ?? '').toString().toLowerCase()
        const valB = (b[key] ?? '').toString().toLowerCase()
        comparison = valA.localeCompare(valB, 'zh-TW')
      }

      return sort.direction === 'desc' ? -comparison : comparison
    })

    return sorted
  }, [keys, sort.key, sort.direction])

  // ========================================
  // Render
  // ========================================

  return (
    <div id="main-content" className="p-6 max-w-6xl">
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-balance text-brand-primary">
            API Key 管理
          </h1>
          <p className="text-sm mt-1 text-text-secondary">
            管理 AI 功能的 API 存取金鑰
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity bg-brand-primary"
        >
          <PlusIcon className="w-4 h-4" />
          生成新 Key
        </button>
      </div>

      {/* Toast Notification */}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <KeyIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-primary">{keys.length}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">全部金鑰</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50">
              <ShieldCheckIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-primary">{activeCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">啟用中</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50">
              <WarningIcon className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-primary">{revokedCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">已撤銷</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Keys Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted">
                <SortableHeader label="名稱" sortKey="name" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Key 前綴" sortKey="key_prefix" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="權限" sortKey="permissions" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="狀態" sortKey="status" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="建立日期" sortKey="created_at" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="最後使用" sortKey="last_used_at" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="過期日" sortKey="expires_at" currentSort={sort} onSort={handleSort} />
                <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 dark:text-slate-500">
                    載入中…
                  </td>
                </tr>
              ) : sortedKeys.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <KeyIcon className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-400 dark:text-slate-500 mb-1">尚未建立任何 API Key</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      點擊「生成新 Key」按鈕建立第一個金鑰
                    </p>
                  </td>
                </tr>
              ) : (
                sortedKeys.map((apiKey) => (
                  <tr
                    key={apiKey.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{apiKey.name}</span>
                    </td>
                    {/* Key Prefix */}
                    <td className="px-4 py-3">
                      <KeyPrefixDisplay prefix={apiKey.key_prefix} />
                    </td>
                    {/* Permissions */}
                    <td className="px-4 py-3">
                      <PermissionBadge permissions={apiKey.permissions} />
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge isActive={apiKey.is_active} expiresAt={apiKey.expires_at} />
                    </td>
                    {/* Created At */}
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {formatDate(apiKey.created_at)}
                    </td>
                    {/* Last Used */}
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {formatDateTime(apiKey.last_used_at)}
                    </td>
                    {/* Expires At */}
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {apiKey.expires_at ? formatDate(apiKey.expires_at) : '永不過期'}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        {apiKey.is_active ? (
                          <button
                            onClick={() => setPendingRevoke(apiKey)}
                            className="px-2.5 py-1.5 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            撤銷
                          </button>
                        ) : (
                          <button
                            onClick={() => setPendingDelete(apiKey)}
                            className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                          >
                            刪除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Note */}
      <div className="mt-6 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
        <div className="flex gap-2">
          <WarningIcon className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-700">
            <p className="font-medium mb-1">安全提醒</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-amber-600">
              <li>API Key 的明文金鑰只會在生成時顯示一次，請妥善保管</li>
              <li>撤銷後的金鑰將立即失效，且無法恢復</li>
              <li>建議為不同用途建立獨立的 Key，並設定合理的過期時間</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ========================================
          Create Key Modal
          ======================================== */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          if (!open) setShowCreateModal(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成新 API Key</DialogTitle>
            <DialogDescription>
              建立一個新的 API 存取金鑰。金鑰只會在建立時顯示一次。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Key Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                名稱 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={createName}
                onChange={(e) => {
                  setCreateName(e.target.value)
                  setCreateError(null)
                }}
                placeholder="例如：Production Bot、Development Testing"
                maxLength={100}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 text-sm"
              />
            </div>

            {/* Permissions */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                權限
              </label>
              <div className="flex gap-3">
                <label
                  className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    createPermissions === 'full'
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="permissions"
                    value="full"
                    checked={createPermissions === 'full'}
                    onChange={() => setCreatePermissions('full')}
                    className="sr-only"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">完整權限</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">可讀取及寫入</p>
                  </div>
                </label>
                <label
                  className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    createPermissions === 'read_only'
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="permissions"
                    value="read_only"
                    checked={createPermissions === 'read_only'}
                    onChange={() => setCreatePermissions('read_only')}
                    className="sr-only"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">唯讀</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">僅可讀取資料</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Expiration Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                過期日期（選填）
              </label>
              <input
                type="date"
                value={createExpiresAt}
                onChange={(e) => setCreateExpiresAt(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 text-sm"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">不設定則永不過期</p>
            </div>

            {/* Error */}
            {createError && (
              <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
                {createError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={createLoading}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateKey}
              disabled={createLoading || !createName.trim()}
            >
              {createLoading ? '生成中...' : '生成 Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================
          Success Modal (Show plaintext key once)
          ======================================== */}
      <Dialog
        open={showSuccessModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowSuccessModal(false)
            setNewKeyPlaintext('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key 已建立</DialogTitle>
            <DialogDescription>
              請立即複製以下金鑰，關閉此視窗後將無法再次查看。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Key Name */}
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">名稱</p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{newKeyName}</p>
            </div>

            {/* Plaintext Key */}
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1.5">API Key</p>
              <div className="relative">
                <div className="w-full px-3 py-3 pr-12 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-100 break-all select-all">
                  {newKeyPlaintext}
                </div>
                <button
                  onClick={handleCopyKey}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  aria-label="複製金鑰"
                  title="複製金鑰"
                >
                  {copied ? (
                    <CheckIcon className="w-4 h-4 text-green-600" />
                  ) : (
                    <CopyIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-green-600 mt-1">已複製到剪貼簿</p>
              )}
            </div>

            {/* Warning */}
            <div className="px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex gap-2">
                <WarningIcon className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  此金鑰只會顯示這一次。如果遺失，需要撤銷並重新建立。
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowSuccessModal(false)
                setNewKeyPlaintext('')
              }}
            >
              我已複製，關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================
          Revoke Confirmation Dialog
          ======================================== */}
      <Dialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRevoke(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>撤銷 API Key</DialogTitle>
            <DialogDescription>
              確定要撤銷「{pendingRevoke?.name}」嗎？
              撤銷後此金鑰將立即失效，所有使用此金鑰的服務將無法存取 API。此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingRevoke(null)}
              disabled={revokeLoading}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeConfirmed}
              disabled={revokeLoading}
            >
              {revokeLoading ? '撤銷中...' : '確認撤銷'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================
          Delete Confirmation Dialog
          ======================================== */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>永久刪除 API Key</DialogTitle>
            <DialogDescription>
              確定要永久刪除「{pendingDelete?.name}」嗎？
              刪除後此金鑰的所有記錄將從系統中移除，此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleteLoading}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirmed}
              disabled={deleteLoading}
            >
              {deleteLoading ? '刪除中...' : '確認刪除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
