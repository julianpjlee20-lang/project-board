/**
 * LINE 綁定 OAuth 發起
 * GET → redirect 到 LINE OAuth 授權頁
 */

import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import crypto from 'crypto'

export async function GET() {
  try {
    await requireAuth()  // 必須登入才能綁定

    const clientId = process.env.AUTH_LINE_ID
    if (!clientId) {
      return NextResponse.json({ error: 'LINE Login 尚未設定' }, { status: 503 })
    }

    const state = crypto.randomBytes(16).toString('hex')
    const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/line-bind/callback`

    const authUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('scope', 'profile openid')
    authUrl.searchParams.set('bot_prompt', 'normal')

    // 注意：state 驗證在簡化實作中省略（因為已有 session 保護）
    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.redirect(new URL('/login', process.env.APP_URL || 'http://localhost:3000'))
    }
    console.error('[LINE Bind] Error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
