'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, X, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react'

// ─── Password Strength ───────────────────────────────────────────────────────

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score: 1, label: '弱', color: '#EF4444' }
  if (score <= 2) return { score: 2, label: '普通', color: '#F59E0B' }
  if (score <= 3) return { score: 3, label: '良好', color: '#3B82F6' }
  return { score: 4, label: '強', color: '#10B981' }
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { score, label, color } = getPasswordStrength(password)
  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${level <= score ? '' : 'bg-slate-200 dark:bg-slate-700'}`}
            style={level <= score ? { backgroundColor: color } : undefined}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color }}>
        密碼強度：{label}
      </p>
    </div>
  )
}

// ─── State types ─────────────────────────────────────────────────────────────

type PageState = 'checking' | 'form' | 'success' | 'invalid'

// ─── Inner content (needs useSearchParams) ───────────────────────────────────

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [pageState, setPageState] = useState<PageState>('checking')
  const [invalidMessage, setInvalidMessage] = useState<string>('此連結可能已被使用或已過期')
  const [maskedEmail, setMaskedEmail] = useState<string>('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Verify token on mount ──────────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setInvalidMessage('缺少重設連結參數')
      setPageState('invalid')
      return
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
        const data = await res.json()

        if (res.ok && data.email) {
          setMaskedEmail(data.email)
          setPageState('form')
        } else {
          setInvalidMessage(data.error ?? '此連結可能已被使用或已過期')
          setPageState('invalid')
        }
      } catch {
        setInvalidMessage('驗證時發生錯誤，請稍後再試')
        setPageState('invalid')
      }
    }

    verifyToken()
  }, [token])

  // ── Submit new password ────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (newPassword !== confirmPassword) {
      setSubmitError('兩次輸入的密碼不一致')
      return
    }

    if (newPassword.length < 6) {
      setSubmitError('密碼至少需要 6 個字元')
      return
    }

    setSubmitLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword, confirm_password: confirmPassword }),
      })

      const data = await res.json()

      if (res.ok) {
        setPageState('success')
      } else {
        setSubmitError(data.error ?? '重設失敗，請稍後再試')
      }
    } catch {
      setSubmitError('發生錯誤，請稍後再試')
    } finally {
      setSubmitLoading(false)
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (pageState === 'checking') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">驗證連結中…</p>
      </div>
    )
  }

  if (pageState === 'success') {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-7 h-7 text-green-600" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-1 text-brand-primary">
            密碼已重設成功
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">請使用新密碼登入</p>
        </div>
        <Link
          href="/login"
          className="mt-2 w-full inline-flex items-center justify-center px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 transition-opacity text-sm bg-brand-primary"
        >
          前往登入
        </Link>
      </div>
    )
  }

  if (pageState === 'invalid') {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <X className="w-7 h-7 text-red-600" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-1 text-brand-primary">
            連結已失效
          </h2>
          <p className="text-red-500 text-sm mb-1">{invalidMessage}</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs">此連結可能已被使用或已過期</p>
        </div>
        <Link
          href="/login"
          className="mt-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:underline"
        >
          返回登入頁
        </Link>
      </div>
    )
  }

  // pageState === 'form'
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  return (
    <div>
      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <KeyRound className="w-6 h-6 text-slate-600 dark:text-slate-300" />
        </div>
        <h2 className="text-2xl font-bold text-brand-primary">
          設定新密碼
        </h2>
        {maskedEmail && (
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            為 <span className="font-medium">{maskedEmail}</span> 設定新密碼
          </p>
        )}
      </div>

      {submitError && (
        <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 新密碼 */}
        <div>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              name="newPassword"
              autoComplete="new-password"
              placeholder="新密碼（至少 6 字元）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 pr-11 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={showNewPassword ? '隱藏密碼' : '顯示密碼'}
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrengthBar password={newPassword} />
        </div>

        {/* 確認密碼 */}
        <div>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="確認新密碼"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={`w-full px-4 py-3 pr-11 rounded-lg border focus:outline-none focus-visible:ring-2 text-sm dark:bg-slate-800 dark:text-slate-200 ${
                passwordMismatch
                  ? 'border-red-300 focus-visible:ring-red-300'
                  : 'border-slate-300 dark:border-slate-600 focus-visible:ring-slate-400'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={showConfirmPassword ? '隱藏密碼' : '顯示密碼'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordMismatch && (
            <p className="mt-1 text-xs text-red-500">兩次輸入的密碼不一致</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitLoading}
          className="w-full px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 text-sm bg-brand-primary"
        >
          {submitLoading ? (<><svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>處理中…</>) : '設定新密碼'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:underline"
        >
          返回登入頁
        </Link>
      </div>
    </div>
  )
}

// ─── Page export (with Suspense for useSearchParams) ─────────────────────────

export default function ResetPasswordPage() {
  return (
    <div
      id="main-content"
      className="min-h-screen flex items-center justify-center px-4 bg-brand-bg"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm">
        <Suspense
          fallback={
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">載入中…</p>
            </div>
          }
        >
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  )
}
