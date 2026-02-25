import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// POST /api/columns
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_id, name } = body

    // Get max position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM columns WHERE project_id = $1',
      [project_id]
    )
    const position = posResult[0]?.pos || 0

    const result = await query(
      'INSERT INTO columns (project_id, name, position) VALUES ($1, $2, $3) RETURNING *',
      [project_id, name, position]
    )

    return NextResponse.json(result[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create column' }, { status: 500 })
  }
}
