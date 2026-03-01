'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export default function UserNav() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-90"
        style={{ backgroundColor: '#F8B500', color: '#0B1A14' }}
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
    <div className="relative" ref={menuRef}>
      {/* 頭像按鈕 */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 transition-all"
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
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: '#316745' }}
          >
            {initial}
          </div>
        )}
      </button>

      {/* 下拉選單 */}
      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-lg border bg-white shadow-lg overflow-hidden"
          style={{
            zIndex: 9999,
            animation: 'userNavFadeIn 150ms ease-out',
            borderColor: '#E5E5E5',
          }}
          role="menu"
          aria-orientation="vertical"
        >
          {/* 使用者資訊 */}
          <div className="px-4 py-3 border-b" style={{ borderColor: '#E5E5E5' }}>
            <p className="text-sm font-medium truncate" style={{ color: '#0B1A14' }}>
              {userName}
            </p>
            {userEmail && (
              <p className="text-xs truncate mt-0.5" style={{ color: '#6B7280' }}>
                {userEmail}
              </p>
            )}
          </div>

          {/* 選單項目 */}
          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
              style={{ color: '#374151' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              role="menuitem"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              設定
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                style={{ color: '#374151' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F3F4F6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
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
          <div className="border-t py-1" style={{ borderColor: '#E5E5E5' }}>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors"
              style={{ color: '#DC2626' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FEF2F2'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
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
  )
}
