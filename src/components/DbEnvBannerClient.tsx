'use client'

import { useState } from 'react'

export default function DbEnvBannerClient({ dbEnv }: { dbEnv: string }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const isProduction = dbEnv === 'production'
  const isTesting = dbEnv === 'testing'

  if (!isProduction && !isTesting) return null

  return (
    <div
      role="alert"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        backgroundColor: isProduction ? '#DC2626' : '#2563EB',
        color: '#FFFFFF',
        fontSize: '13px',
        fontWeight: 500,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isProduction ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          )}
        </svg>
        <span>
          {isProduction
            ? '⚠ 警告：目前連接的是 Production 資料庫！操作將影響真實資料。'
            : 'ℹ 提示：目前連接的是 Testing 資料庫（測試環境）'}
        </span>
      </div>

      <button
        onClick={() => setDismissed(true)}
        aria-label="關閉提示"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#FFFFFF',
          padding: '4px',
          opacity: 0.8,
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  )
}
