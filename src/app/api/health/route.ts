import { query } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const checks: Record<string, unknown> = {}

  // 1. DB 連線測試
  try {
    const result = await query("SELECT NOW() as time")
    checks.database = { ok: true, time: result[0].time }
  } catch (error) {
    checks.database = { ok: false, error: String(error) }
  }

  // 2. profiles 表是否存在
  try {
    const result = await query(
      "SELECT COUNT(*) as count FROM profiles"
    )
    checks.profiles_table = { ok: true, count: Number(result[0].count) }
  } catch (error) {
    checks.profiles_table = { ok: false, error: String(error) }
  }

  const allOk = checks.database && (checks.database as { ok: boolean }).ok
    && checks.profiles_table && (checks.profiles_table as { ok: boolean }).ok

  return NextResponse.json(checks, { status: allOk ? 200 : 503 })
}
