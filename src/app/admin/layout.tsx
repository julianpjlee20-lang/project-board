'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface SessionData {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
    /** role 是自訂 session 欄位，由 auth.ts session callback 注入 */
    role?: string | null
  }
}

const NAV_ITEMS = [
  { href: '/admin', label: '儀表板', icon: DashboardIcon },
  { href: '/admin/users', label: '使用者管理', icon: UsersIcon },
  { href: '/admin/projects', label: '專案概覽', icon: ProjectsIcon },
  { href: '/admin/notifications', label: '通知管理', icon: BellIcon },
  { href: '/admin/api-keys', label: 'API Key 管理', icon: KeyIcon },
]

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function ProjectsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
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

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286ZM12 15.75h.008v.008H12v-.008Z" />
    </svg>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [session, setSession] = useState<SessionData | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ESC 鍵關閉手機版側邊欄
  useEffect(() => {
    if (!sidebarOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session')
        if (res.ok) {
          const data = await res.json()
          setSession(data)
        }
      } catch {
        // 靜默處理
      } finally {
        setAuthLoading(false)
      }
    }
    fetchSession()
  }, [])

  // 點擊導航後關閉 mobile sidebar
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  function isActive(href: string): boolean {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(href)
  }

  // 載入中
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-secondary">驗證權限中...</p>
        </div>
      </div>
    )
  }

  // 未登入或非 admin
  if (!session?.user || session.user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center max-w-sm mx-auto px-4">
          <ShieldIcon className="w-16 h-16 mx-auto mb-4 text-priority-high" />
          <h1 className="text-2xl font-bold mb-2 text-brand-primary">
            無存取權限
          </h1>
          <p className="text-sm mb-6 text-text-secondary">
            {!session?.user
              ? '請先登入才能存取管理後台。'
              : '您的帳號不具備管理員權限。'}
          </p>
          <div className="flex gap-3 justify-center">
            {!session?.user ? (
              <Link
                href="/login"
                className="px-6 py-2.5 text-white rounded-lg font-medium hover:opacity-90 transition-opacity text-sm bg-brand-primary"
              >
                前往登入
              </Link>
            ) : (
              <Link
                href="/projects"
                className="px-6 py-2.5 text-white rounded-lg font-medium hover:opacity-90 transition-opacity text-sm bg-brand-primary"
              >
                回到看板
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  const sidebarContent = (
    <>
      {/* Sidebar Header */}
      <div className="px-5 py-6 border-b border-border-default">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-primary">
            管理後台
          </h2>
          <div className="flex items-center gap-1">
            <Link
              href="/projects"
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-text-secondary"
              title="返回看板"
            >
              <BackIcon className="w-4.5 h-4.5" />
            </Link>
            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 rounded-lg hover:bg-muted transition-colors"
              aria-label="關閉選單"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-surface-subtle'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section: user info + back link */}
      <div className="px-3 pb-4">
        <div className="h-px mb-3 bg-border-default" />

        {/* Logged-in user */}
        {session.user.name && (
          <div className="px-3 py-2 mb-2">
            <div className="flex items-center gap-2">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-7 h-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white bg-blue-400">
                  {session.user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-700 dark:text-gray-300">
                  {session.user.name}
                </p>
                <p className="text-xs truncate text-text-tertiary">
                  管理員
                </p>
              </div>
            </div>
          </div>
        )}

        <Link
          href="/projects"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-text-secondary hover:bg-surface-subtle"
        >
          <BackIcon className="w-5 h-5" />
          返回看板
        </Link>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-brand-bg">
      {/* Mobile top bar */}
      <div className="fixed top-4 left-4 right-4 z-40 md:hidden flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg bg-surface-elevated shadow-md hover:bg-muted transition-colors"
          aria-label="開啟選單"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
        <Link
          href="/projects"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-elevated shadow-md text-sm font-medium hover:bg-muted transition-colors text-gray-700 dark:text-gray-300"
        >
          <BackIcon className="w-4 h-4" />
          返回看板
        </Link>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside
        className="hidden md:flex w-60 flex-shrink-0 flex-col border-r bg-surface-elevated border-border-default"
      >
        {sidebarContent}
      </aside>

      {/* Sidebar - Mobile (slide-in) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-border-default bg-surface-elevated shadow-xl transition-transform duration-200 ease-in-out md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
