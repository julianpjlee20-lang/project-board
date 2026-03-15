'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export default function UserNav() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // 取得未讀通知數量
  const fetchCount = () => {
    fetch('/api/notifications/count')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.count != null) setNotificationCount(data.count)
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchCount()
    // 每 60 秒輪詢刷新通知數量
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [status])

  // 監聽 dismiss 事件，即時更新 badge
  useEffect(() => {
    const handler = () => fetchCount()
    window.addEventListener('notification-dismissed', handler)
    return () => window.removeEventListener('notification-dismissed', handler)
  }, [])

  // 點擊外部關閉下拉選單
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // 按 Escape 關閉
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // 載入中：不顯示任何東西，避免閃爍
  if (status === 'loading') {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
    )
  }

  // 未登入狀態
  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-90 bg-brand-accent text-brand-primary"
      >
        登入
      </Link>
    )
  }

  const user = session.user
  const userName = user.name || user.email || '使用者'
  const userEmail = user.email || ''
  const avatarUrl = user.image
  const isAdmin = user.role === 'admin'
  const initial = userName.charAt(0).toUpperCase()

  async function handleSignOut() {
    try {
      await signOut({ callbackUrl: '/login' })
    } catch {
      // signOut 失敗時靜默處理；頁面仍可正常使用
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* 鈴鐺 */}
      <Link
        href="/notifications"
        className="relative p-2 rounded-full transition-colors text-[#F9F8F5] hover:bg-white/10"
        aria-label="通知中心"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {notificationCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1 bg-destructive"
          >
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
      </Link>

      {/* 原有的頭像 + 下拉選單 */}
      <div className="relative" ref={menuRef}>
        {/* 頭像按鈕 */}
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 transition-shadow"
          aria-expanded={open}
          aria-haspopup="true"
          aria-label="使用者選單"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userName}
              className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-sm bg-brand-green"
            >
              {initial}
            </div>
          )}
        </button>

        {/* 下拉選單 */}
        {open && (
          <div
            className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden"
            style={{
              zIndex: 9999,
              animation: 'userNavFadeIn 150ms ease-out',
            }}
            role="menu"
            aria-orientation="vertical"
          >
            {/* 使用者資訊 */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <p className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">
                {userName}
              </p>
              {userEmail && (
                <p className="text-xs truncate mt-0.5 text-slate-500 dark:text-slate-400">
                  {userEmail}
                </p>
              )}
            </div>

            {/* 選單項目 */}
            <div className="py-1">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                role="menuitem"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                設定
              </Link>

              {user.provider === 'credentials' && (
                <Link
                  href="/settings#password"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  role="menuitem"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  更改密碼
                </Link>
              )}

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  role="menuitem"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                  管理後台
                </Link>
              )}
            </div>

            {/* 分隔線 + 登出 */}
            <div className="border-t border-slate-200 dark:border-slate-700 py-1">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                role="menuitem"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
                </svg>
                登出
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
