import { NextResponse } from "next/server"

export async function GET() {
  try {
    // 1. 檢查環境變數
    const hasLineId = !!process.env.AUTH_LINE_ID
    const hasLineSecret = !!process.env.AUTH_LINE_SECRET
    const lineIdPrefix = process.env.AUTH_LINE_ID?.substring(0, 4) || "N/A"

    // 2. 測試 LINE OIDC discovery
    let discoveryOk = false
    let discoveryError = ""
    try {
      const res = await fetch("https://access.line.me/.well-known/openid-configuration")
      discoveryOk = res.ok
      if (!res.ok) {
        discoveryError = `HTTP ${res.status}`
      }
    } catch (e) {
      discoveryError = String(e)
    }

    return NextResponse.json({
      env: { hasLineId, hasLineSecret, lineIdPrefix },
      discovery: { ok: discoveryOk, error: discoveryError || null },
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
