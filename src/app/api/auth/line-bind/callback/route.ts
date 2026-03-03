/**
 * LINE 綁定 OAuth 回呼
 * GET → 接收 LINE 回傳的 code，換 token，更新 profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  try {
    const user = await requireAuth()

    const code = request.nextUrl.searchParams.get('code')
    if (!code) {
      return NextResponse.redirect(`${appUrl}/settings?line=error&reason=no_code`)
    }

    const clientId = process.env.AUTH_LINE_ID
    const clientSecret = process.env.AUTH_LINE_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/settings?line=error&reason=not_configured`)
    }

    const redirectUri = `${appUrl}/api/auth/line-bind/callback`

    // 用 code 換 access_token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenRes.ok) {
      console.error('[LINE Bind Callback] Token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${appUrl}/settings?line=error&reason=token_failed`)
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // 用 access_token 取得 LINE profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!profileRes.ok) {
      console.error('[LINE Bind Callback] Profile fetch failed:', await profileRes.text())
      return NextResponse.redirect(`${appUrl}/settings?line=error&reason=profile_failed`)
    }

    const lineProfile = await profileRes.json()
    const lineUserId = lineProfile.userId
    const lineDisplayName = lineProfile.displayName
    const linePictureUrl = lineProfile.pictureUrl || null

    // 檢查此 LINE ID 是否已被其他帳號使用
    const existing = await query(
      'SELECT id FROM profiles WHERE line_user_id = $1 AND id != $2',
      [lineUserId, user.id]
    )

    if (existing.length > 0) {
      return NextResponse.redirect(`${appUrl}/settings?line=error&reason=already_linked`)
    }

    // 更新當前用戶的 LINE 綁定資訊
    await query(
      `UPDATE profiles
       SET line_user_id = $1,
           line_display_name = $2,
           line_picture_url = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [lineUserId, lineDisplayName, linePictureUrl, user.id]
    )

    return NextResponse.redirect(`${appUrl}/settings?line=bound`)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.redirect(`${appUrl}/login`)
    }
    console.error('[LINE Bind Callback] Error:', error)
    return NextResponse.redirect(`${appUrl}/settings?line=error&reason=server_error`)
  }
}
