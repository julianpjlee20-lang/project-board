import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID
const CHANNEL_SECRET = process.env.LINE_LOGIN_CHANNEL_SECRET
const REDIRECT_URI = process.env.LINE_LOGIN_REDIRECT_URI

// GET /api/auth/line/callback - LINE OAuth 回調處理
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // 使用者拒絕授權或其他錯誤
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${error}`, request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=missing_params', request.url))
  }

  // 驗證 state（防 CSRF）
  const savedState = request.cookies.get('line_oauth_state')?.value
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL('/login?error=invalid_state', request.url))
  }

  const savedNonce = request.cookies.get('line_oauth_nonce')?.value

  try {
    // 1. 用授權碼換取 access_token + id_token
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI!,
        client_id: CHANNEL_ID!,
        client_secret: CHANNEL_SECRET!,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenData.id_token) {
      console.error('LINE token exchange failed:', tokenData)
      return NextResponse.redirect(new URL('/login?error=token_failed', request.url))
    }

    // 2. 驗證 id_token 並取得使用者資訊
    const verifyResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        id_token: tokenData.id_token,
        client_id: CHANNEL_ID!,
        ...(savedNonce ? { nonce: savedNonce } : {}),
      }),
    })

    const lineUser = await verifyResponse.json()

    if (!lineUser.sub) {
      console.error('LINE token verify failed:', lineUser)
      return NextResponse.redirect(new URL('/login?error=verify_failed', request.url))
    }

    // 3. Upsert 使用者到 profiles 表
    const lineUserId = lineUser.sub
    const displayName = lineUser.name || null
    const pictureUrl = lineUser.picture || null

    const existingUser = await query(
      'SELECT id FROM profiles WHERE line_user_id = $1',
      [lineUserId]
    )

    if (existingUser.length === 0) {
      // 新使用者：建立 profile
      await query(
        `INSERT INTO profiles (name, avatar_url, line_user_id, line_display_name, line_picture_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [displayName, pictureUrl, lineUserId, displayName, pictureUrl]
      )
    } else {
      // 既有使用者：更新 LINE 資料
      await query(
        `UPDATE profiles
         SET name = COALESCE($1, name),
             avatar_url = COALESCE($2, avatar_url),
             line_display_name = $3,
             line_picture_url = $4
         WHERE line_user_id = $5`,
        [displayName, pictureUrl, displayName, pictureUrl, lineUserId]
      )
    }

    // 4. 設定登入 cookie 並重導
    const response = NextResponse.redirect(new URL('/projects', request.url))

    response.cookies.set('line_user_id', lineUserId, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 7 天
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })

    // 清除暫存的 OAuth cookies
    response.cookies.set('line_oauth_state', '', { maxAge: 0, path: '/' })
    response.cookies.set('line_oauth_nonce', '', { maxAge: 0, path: '/' })

    return response
  } catch (err) {
    console.error('LINE OAuth callback error:', err)
    return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url))
  }
}
