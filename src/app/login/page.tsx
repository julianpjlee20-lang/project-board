'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Email 或密碼錯誤',
  AccountInactive: '帳號尚未啟用，請聯繫管理員',
  OAuthSignin: 'OAuth 登入請求失敗，請重試',
  OAuthCallback: 'OAuth 回調處理失敗',
  OAuthAccountNotLinked: '此帳號已與其他登入方式綁定',
  AccessDenied: '存取被拒絕',
  Configuration: '伺服器設定錯誤，請聯繫管理員',
}

function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForgotHint, setShowForgotHint] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const errorCode = searchParams.get('error')
  const urlError = errorCode
    ? ERROR_MESSAGES[errorCode] || '登入失敗，請重試'
    : null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Email 或密碼錯誤')
      setLoading(false)
    } else {
      router.push('/projects')
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '註冊失敗')
        setLoading(false)
        return
      }

      setSuccess('帳號已建立，請等待管理員審核後再登入')
      setIsRegister(false)
      setLoading(false)
    } catch {
      setError('註冊失敗，請稍後再試')
      setLoading(false)
    }
  }

  const handleDiscordLogin = () => {
    setLoading(true)
    signIn('discord', { callbackUrl: '/projects' })
  }

  const handleLineLogin = () => {
    setLoading(true)
    signIn('line', { callbackUrl: '/projects' })
  }

  return (
    <div className="text-center w-full max-w-sm mx-auto px-4">
      <h1 className="text-3xl font-bold mb-2" style={{ color: '#0B1A14' }}>
        Project Board
      </h1>
      <p className="mb-8 text-slate-600">
        {isRegister ? '建立帳號' : '登入以開始使用'}
      </p>

      {(error || urlError) && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {error || urlError}
        </div>
      )}

      {success && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-600 text-sm">
          {success}
        </div>
      )}

      {/* 帳號密碼表單 */}
      <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
        {isRegister && (
          <input
            type="text"
            placeholder="名稱（選填）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
        />
        <input
          type="password"
          placeholder="密碼（至少 6 字元）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 text-sm"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#0B1A14' }}
        >
          {loading ? '處理中...' : isRegister ? '註冊' : '登入'}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={() => {
            setIsRegister(!isRegister)
            setError(null)
            setSuccess(null)
            setShowForgotHint(false)
          }}
          className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
        >
          {isRegister ? '已有帳號？登入' : '沒有帳號？註冊'}
        </button>
        {!isRegister && (
          <>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => setShowForgotHint(!showForgotHint)}
              className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
            >
              忘記密碼？
            </button>
          </>
        )}
      </div>

      {showForgotHint && !isRegister && (
        <div className="mt-3 px-4 py-3 rounded-lg bg-amber-50 text-amber-700 text-sm">
          請聯繫管理員取得密碼重設連結
        </div>
      )}

      {/* 分隔線 */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-slate-300" />
        <span className="text-sm text-slate-400">或</span>
        <div className="flex-1 h-px bg-slate-300" />
      </div>

      {/* Discord 登入 */}
      <button
        onClick={handleDiscordLogin}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 rounded-lg font-medium border-2 bg-transparent hover:opacity-80 transition-opacity disabled:opacity-50"
        style={{ borderColor: '#5865F2', color: '#5865F2' }}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        用 Discord 登入
      </button>

      {/* LINE 登入 */}
      <button
        onClick={handleLineLogin}
        disabled={loading}
        className="w-full mt-3 inline-flex items-center justify-center gap-3 px-6 py-3 rounded-lg font-medium border-2 bg-transparent hover:opacity-80 transition-opacity disabled:opacity-50"
        style={{ borderColor: '#06C755', color: '#06C755' }}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
        </svg>
        用 LINE 登入
      </button>

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
