import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/cards/[id]/activity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const activity = await query(`
      SELECT al.*, p.name as user_name
      FROM activity_logs al
      LEFT JOIN profiles p ON al.user_id = p.id
      WHERE al.card_id = $1
      ORDER BY al.created_at DESC
      LIMIT 20
    `, [id])

    return NextResponse.json(activity)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
