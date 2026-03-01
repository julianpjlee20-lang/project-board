'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

export default function ForcePasswordBanner() {
  const { data: session } = useSession()
  const [dismissed, setDismissed] = useState(false)

  if (!session?.user?.forcePasswordChange || dismissed) {
    return null
  }

  return (
    <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          {/* Warning Icon */}
          <svg
            className="w-5 h-5 text-amber-600 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <p className="text-sm text-amber-800">
            管理員已重設您的密碼，請立即更改以確保帳號安全
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            立即更改
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md text-amber-600 hover:bg-amber-100 transition-colors"
            aria-label="關閉提示"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
