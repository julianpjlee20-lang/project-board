import { NextResponse } from 'next/server'

// POST /api/auth/logout - 登出（清除所有登入 cookies）
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url))

  // 清除 LINE 登入 cookie
  response.cookies.set('line_user_id', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })

  // 清除 Discord 登入 cookie
  response.cookies.set('discord_id', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })

  return response
}
