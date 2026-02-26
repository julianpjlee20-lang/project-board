import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/projects/[id]/tags
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    
    const tags = await query(
      'SELECT * FROM tags WHERE project_id = $1 ORDER BY name',
      [projectId]
    )

    return NextResponse.json(tags)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

// POST /api/projects/[id]/tags
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = await request.json()
    const { name, color } = body

    const result = await query(
      'INSERT INTO tags (project_id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [projectId, name, color || '#4EA7FC']
    )

    return NextResponse.json(result[0])
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/tags
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const tag_id = searchParams.get('tag_id')

    if (!tag_id) {
      return NextResponse.json({ error: 'Tag ID required' }, { status: 400 })
    }

    await query('DELETE FROM tags WHERE id = $1 AND project_id = $2', [tag_id, projectId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}
