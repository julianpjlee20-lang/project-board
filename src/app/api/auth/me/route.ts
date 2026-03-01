import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

// GET /api/auth/me - 取得當前登入使用者資訊
export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: '未登入' },
        { status: 401 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('GET /api/auth/me error:', error)
    return NextResponse.json(
      { error: '取得使用者資訊失敗', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
