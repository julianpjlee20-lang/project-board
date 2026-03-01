import { auth } from "@/auth"
import { NextResponse } from "next/server"

// GET /api/auth/me - 取得當前登入使用者資訊（Auth.js v5）
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ user: null })
  }
  return NextResponse.json({ user: session.user })
}
