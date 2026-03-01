import { NextResponse } from 'next/server'
import crypto from 'crypto'

const CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID
const REDIRECT_URI = process.env.LINE_LOGIN_REDIRECT_URI

// GET /api/auth/line - 啟動 LINE OAuth 流程
export async function GET() {
  if (!CHANNEL_ID || !REDIRECT_URI) {
    return NextResponse.json(
      { error: 'LINE Login 環境變數未設定' },
      { status: 500 }
    )
  }

  // 生成 state（防 CSRF）與 nonce（防重放）
  const state = crypto.randomBytes(16).toString('hex')
  const nonce = crypto.randomBytes(16).toString('hex')

  // 組裝 LINE 授權 URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CHANNEL_ID,
    redirect_uri: REDIRECT_URI,
    state,
    scope: 'profile openid',
    nonce,
    bot_prompt: 'aggressive',
  })

  const authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`

  // 重導至 LINE 授權頁面，並暫存 state/nonce 到 httpOnly cookie
  const response = NextResponse.redirect(authUrl)

  response.cookies.set('line_oauth_state', state, {
    httpOnly: true,
    maxAge: 300, // 5 分鐘有效
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  response.cookies.set('line_oauth_nonce', nonce, {
    httpOnly: true,
    maxAge: 300,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  return response
}
