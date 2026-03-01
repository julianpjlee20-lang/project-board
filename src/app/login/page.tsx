'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: '登入驗證失敗，請重試',
  token_failed: 'Token 取得失敗',
  verify_failed: '身份驗證失敗',
  oauth_failed: '登入過程發生錯誤',
}

function LoginContent() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  const errorCode = searchParams.get('error')
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] || '登入失敗，請重試'
    : null

  const handleLineLogin = () => {
    setLoading(true)
    window.location.href = '/api/auth/line'
  }

  const handleDiscordLogin = () => {
    setLoading(true)
    window.location.href = '/api/auth/discord'
  }

  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold mb-4" style={{ color: '#0B1A14' }}>
        Project Board
      </h1>
      <p className="mb-8 text-slate-600">
        登入以開始使用
      </p>

      {errorMessage && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {errorMessage}
        </div>
      )}

      {/* LINE 登入 — 主要按鈕 */}
      <button
        onClick={handleLineLogin}
        disabled={loading}
        className="w-64 inline-flex items-center justify-center gap-3 px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ backgroundColor: '#06C755' }}
      >
        {loading ? (
          <span>載入中...</span>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            用 LINE 登入
          </>
        )}
      </button>

      {/* 分隔線 */}
      <div className="flex items-center gap-4 my-6 w-64 mx-auto">
        <div className="flex-1 h-px bg-slate-300" />
        <span className="text-sm text-slate-400">或</span>
        <div className="flex-1 h-px bg-slate-300" />
      </div>

      {/* Discord 登入 — 次要按鈕 (outline) */}
      <button
        onClick={handleDiscordLogin}
        disabled={loading}
        className="w-64 inline-flex items-center justify-center gap-3 px-6 py-3 rounded-lg font-medium border-2 bg-transparent hover:opacity-80 transition-opacity disabled:opacity-50"
        style={{ borderColor: '#5865F2', color: '#5865F2' }}
      >
        {loading ? (
          <span>載入中...</span>
        ) : (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0 .062.027 19.82 19.82 0 0 0 13.055 6.033.076.076 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 0-.051.015c-.173.242-.397.712-.613 1.25a18.252 18.252 0 0 1-5.479 0 13.13 13.13 0 0 1-.613-1.25.077.077 0 0 0-.051-.015 13.114 13.114 0 0 1-1.873-.892.077.077 0 0 0-.041.106c.31.384.734.832 1.225 1.994a.07.07 0 0 0 .063.028 19.822 19.822 0 0 0 13.056 6.033.07.07 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.112 13.112 0 0 1-1.872-.892.077.077 0 0 0-.051.015c-.173.242-.397.712-.613 1.25a18.252 18.252 0 0 1-5.479 0 13.13 13.13 0 0 1-.613-1.25.077.077 0 0 0-.051-.015 13.114 13.114 0 0 1-1.873-.892.077.077 0 0 0-.041.106c.31.384.734.832 1.225 1.994zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            用 Discord 登入
          </>
        )}
      </button>

      <div className="mt-8">
        <Link href="/projects" className="text-sm text-slate-500 hover:underline">
          略過登入 →
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F9F8F5' }}>
      <Suspense fallback={
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4" style={{ color: '#0B1A14' }}>
            Project Board
          </h1>
          <p className="mb-8 text-slate-600">載入中...</p>
        </div>
      }>
        <LoginContent />
      </Suspense>
    </div>
  )
}
