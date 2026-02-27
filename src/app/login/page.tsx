'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleDiscordLogin = () => {
    setLoading(true)
    window.location.href = '/api/auth/discord'
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F9F8F5' }}>
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4" style={{ color: '#0B1A14' }}>
          Project Board
        </h1>
        <p className="mb-8 text-slate-600">
          登入以開始使用
        </p>
        
        <button
          onClick={handleDiscordLogin}
          disabled={loading}
          className="inline-flex items-center gap-3 px-6 py-3 bg-[#5865F2] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
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
    </div>
  )
}
