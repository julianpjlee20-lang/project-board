'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// ========================================
// Types
// ========================================

interface User {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
  role: 'admin' | 'user'
  is_active: boolean
  login_method: 'credentials' | 'discord' | 'both'
  created_at: string
}

interface UsersResponse {
  users: User[]
  total: number
  page: number
  limit: number
}

// ========================================
// Constants
// ========================================

const PAGE_SIZE = 20
const DEBOUNCE_MS = 300

// ========================================
// Helper Components
// ========================================

function RoleBadge({ role }: { role: User['role'] }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        管理員
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
      一般使用者
    </span>
  )
}

function StatusBadge({ isActive, createdAt }: { isActive: boolean; createdAt: string }) {
  // 「pending」判定：is_active=false 且建立時間在 7 天內
  const isRecent = Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000

  if (isActive) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        啟用
      </span>
    )
  }

  if (!isActive && isRecent) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        待審核
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      停用
    </span>
  )
}

function UserAvatar({ user }: { user: User }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.name || user.email}
        className="w-8 h-8 rounded-full object-cover"
      />
    )
  }

  // Fallback: 首字母圓形
  const initial = (user.name || user.email || '?')[0].toUpperCase()
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
      style={{ backgroundColor: '#94A3B8' }}
    >
      {initial}
    </div>
  )
}

function LoginMethodLabel({ method }: { method: User['login_method'] }) {
  const labels: Record<string, string> = {
    credentials: '帳密',
    discord: 'Discord',
    both: '帳密 + Discord',
  }
  return (
    <span className="text-xs text-slate-500">
      {labels[method] || method}
    </span>
  )
}

// ========================================
// Search Icon (inline SVG, no extra dependency)
// ========================================

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}

// ========================================
// Main Content (wrapped in Suspense for useSearchParams)
// ========================================

function UsersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Read initial filter state from URL
  const initialSearch = searchParams.get('search') || ''
  const initialRole = searchParams.get('role') || ''
  const initialStatus = searchParams.get('status') || ''
  const initialPage = parseInt(searchParams.get('page') || '1', 10) || 1

  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [roleFilter, setRoleFilter] = useState(initialRole)
  const [statusFilter, setStatusFilter] = useState(initialStatus)

  // Quick action state
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [pendingDeactivate, setPendingDeactivate] = useState<User | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // Reset to page 1 when search changes
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [roleFilter, statusFilter])

  // Sync URL search params
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (roleFilter) params.set('role', roleFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (page > 1) params.set('page', String(page))

    const queryString = params.toString()
    const newUrl = queryString ? `/admin/users?${queryString}` : '/admin/users'
    router.replace(newUrl, { scroll: false })
  }, [debouncedSearch, roleFilter, statusFilter, page, router])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)

    // AbortController 防止 race condition
    const controller = new AbortController()

    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (roleFilter) params.set('role', roleFilter)
      // pending 與 inactive 都傳 is_active=false；pending 的區分由前端在拿到資料後過濾
      if (statusFilter === 'active') params.set('is_active', 'true')
      else if (statusFilter === 'inactive' || statusFilter === 'pending') params.set('is_active', 'false')
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      params.set('sort', 'created_at')
      params.set('order', 'desc')

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: 'include',
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '載入使用者列表失敗')
      }

      const data: UsersResponse = await res.json()

      // 若選擇 pending，在前端做二次過濾（is_active=false 且建立時間在 7 天內）
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
      const filteredUsers =
        statusFilter === 'pending'
          ? data.users.filter(
              (u) => !u.is_active && Date.now() - new Date(u.created_at).getTime() < SEVEN_DAYS_MS
            )
          : data.users

      setUsers(filteredUsers)
      // pending 模式下 total 顯示過濾後數量，避免分頁計算錯誤
      setTotal(statusFilter === 'pending' ? filteredUsers.length : data.total)
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
      setError(err instanceof Error ? err.message : '載入使用者列表失敗')
    } finally {
      setLoading(false)
    }

    return () => controller.abort()
  }, [debouncedSearch, roleFilter, statusFilter, page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Quick actions
  async function handleActivate(user: User) {
    setActionLoading(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: true }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '操作失敗')
      }

      setToast({ type: 'success', message: `已啟用「${user.name || user.email}」` })
      await fetchUsers()
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : '操作失敗' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeactivateConfirmed() {
    if (!pendingDeactivate) return

    const user = pendingDeactivate
    setPendingDeactivate(null)
    setActionLoading(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: false }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '操作失敗')
      }

      setToast({ type: 'success', message: `已停用「${user.name || user.email}」` })
      await fetchUsers()
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : '操作失敗' })
    } finally {
      setActionLoading(null)
    }
  }

  // Pagination
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endIndex = Math.min(page * PAGE_SIZE, total)

  function renderPaginationButtons() {
    const buttons: React.ReactNode[] = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => setPage(i)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            i === page
              ? 'bg-slate-800 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {i}
        </button>
      )
    }

    return buttons
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#0B1A14' }}>
          使用者管理
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          管理系統中的所有使用者帳號
        </p>
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

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋名稱或 Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
          />
        </div>

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">所有角色</option>
          <option value="admin">管理員</option>
          <option value="user">一般使用者</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">所有狀態</option>
          <option value="active">啟用</option>
          <option value="inactive">停用</option>
          <option value="pending">待審核</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ backgroundColor: '#FAFAFA' }}>
                <th className="text-left px-4 py-3 font-medium text-slate-500">使用者</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">角色</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">狀態</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">登入方式</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">建立日期</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    載入中...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    {debouncedSearch || roleFilter || statusFilter
                      ? '沒有符合條件的使用者'
                      : '尚無使用者'}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 transition-colors"
                  >
                    {/* Avatar + Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} />
                        <span className="font-medium text-slate-800">
                          {user.name || '(未設定)'}
                        </span>
                      </div>
                    </td>
                    {/* Email */}
                    <td className="px-4 py-3 text-slate-600">
                      {user.email}
                    </td>
                    {/* Role */}
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge isActive={user.is_active} createdAt={user.created_at} />
                    </td>
                    {/* Login Method */}
                    <td className="px-4 py-3">
                      <LoginMethodLabel method={user.login_method} />
                    </td>
                    {/* Created At */}
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(user.created_at).toLocaleDateString('zh-TW')}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {user.is_active ? (
                          <button
                            onClick={() => setPendingDeactivate(user)}
                            disabled={actionLoading === user.id}
                            className="px-2.5 py-1.5 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === user.id ? '處理中...' : '停用'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(user)}
                            disabled={actionLoading === user.id}
                            className="px-2.5 py-1.5 text-xs rounded-md border border-green-200 text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === user.id ? '處理中...' : '啟用'}
                          </button>
                        )}
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="px-2.5 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          詳情
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ backgroundColor: '#FAFAFA' }}>
            <span className="text-sm text-slate-500">
              第 {startIndex}-{endIndex} 筆，共 {total} 筆
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                上一頁
              </button>
              {renderPaginationButtons()}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                下一頁
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Deactivate Confirmation Dialog */}
      <Dialog
        open={pendingDeactivate !== null}
        onOpenChange={(open) => { if (!open) setPendingDeactivate(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>停用帳號</DialogTitle>
            <DialogDescription>
              確定要停用「{pendingDeactivate?.name || pendingDeactivate?.email}」的帳號嗎？
              該使用者將無法登入系統。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeactivate(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeactivateConfirmed}>
              確認停用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ========================================
// Page Export (with Suspense for useSearchParams)
// ========================================

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#0B1A14' }}>使用者管理</h1>
        <div className="text-slate-400">載入中...</div>
      </div>
    }>
      <UsersContent />
    </Suspense>
  )
}
