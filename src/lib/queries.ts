import { query } from './db'

/**
 * Server-side data fetching functions
 * Used by Server Components to fetch data directly from the database
 */

// ──────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────

export interface ProjectRow {
  id: string
  name: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

export async function fetchProjects(): Promise<ProjectRow[]> {
  return query("SELECT * FROM projects ORDER BY created_at DESC")
}

export async function fetchProject(projectId: string): Promise<ProjectRow | null> {
  const rows = await query('SELECT * FROM projects WHERE id = $1', [projectId])
  return rows[0] || null
}

// ──────────────────────────────────────────────
// Columns + Cards (for Board page)
// ──────────────────────────────────────────────

export async function fetchColumnsWithCards(projectId: string) {
  // Auto-archive: 完成超過 7 天的卡片自動封存
  await query(`
    UPDATE cards SET is_archived = true, archived_at = NOW()
    WHERE column_id IN (
      SELECT id FROM columns WHERE project_id = $1
      AND (name ILIKE '%done%' OR name ILIKE '%完成%')
    )
    AND actual_completion_date IS NOT NULL
    AND actual_completion_date < NOW() - INTERVAL '7 days'
    AND (is_archived = false OR is_archived IS NULL)
  `, [projectId])

  // Get columns
  const columns = await query(
    'SELECT * FROM columns WHERE project_id = $1 ORDER BY position',
    [projectId]
  )

  // Get all cards in one query (eliminates N+1)
  const columnIds = columns.map((c: { id: string }) => c.id)
  const allCards = columnIds.length > 0 ? await query(`
    SELECT c.id, c.card_number, c.title, c.description, c.progress,
           c.priority, c.due_date, c.planned_completion_date,
           c.actual_completion_date, c.start_date, c.position,
           c.phase_id, c.column_id, c.created_at, c.rolling_due_date,
      COALESCE(json_agg(DISTINCT jsonb_build_object('id', ca.user_id, 'name', p.name)) FILTER (WHERE ca.user_id IS NOT NULL), '[]') as assignees,
      COALESCE(
        (SELECT json_agg(json_build_object('id', s.id, 'title', s.title, 'is_completed', s.is_completed, 'position', s.position, 'due_date', s.due_date, 'assignee_id', s.assignee_id, 'assignee_name', sp.name) ORDER BY s.position)
         FROM subtasks s LEFT JOIN profiles sp ON s.assignee_id = sp.id WHERE s.card_id = c.id),
        '[]'
      ) as subtasks,
      COALESCE(
        (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
         FROM tags t JOIN card_tags ct ON t.id = ct.tag_id WHERE ct.card_id = c.id),
        '[]'
      ) as tags
    FROM cards c
    LEFT JOIN card_assignees ca ON c.id = ca.card_id
    LEFT JOIN profiles p ON ca.user_id = p.id
    WHERE c.column_id = ANY($1::uuid[])
      AND (c.is_archived = false OR c.is_archived IS NULL)
    GROUP BY c.id
    ORDER BY c.position
  `, [columnIds]) : []

  // Group cards by column in JS
  for (const col of columns) {
    col.cards = allCards.filter((c: { column_id: string }) => c.column_id === col.id)
  }

  return columns
}

// ──────────────────────────────────────────────
// Phases
// ──────────────────────────────────────────────

interface PhaseRow {
  id: string
  project_id: string
  name: string
  color: string
  position: number
  created_at: string
  total_cards: number
  completed_cards: number
}

export async function fetchPhases(projectId: string) {
  const phases = await query(`
    SELECT p.*,
      COUNT(c.id)::int AS total_cards,
      COUNT(c.id) FILTER (WHERE col.name ILIKE '%done%' OR col.name ILIKE '%完成%')::int AS completed_cards
    FROM phases p
    LEFT JOIN cards c ON c.phase_id = p.id AND (c.is_archived = false OR c.is_archived IS NULL)
    LEFT JOIN columns col ON c.column_id = col.id
    WHERE p.project_id = $1
    GROUP BY p.id
    ORDER BY p.position
  `, [projectId])

  return (phases as PhaseRow[]).map((phase) => ({
    ...phase,
    progress: phase.total_cards > 0
      ? Math.round((phase.completed_cards / phase.total_cards) * 100)
      : 0
  }))
}

// ──────────────────────────────────────────────
// Calendar (cross-project)
// ──────────────────────────────────────────────

export async function fetchCalendarData() {
  const cards = await query(`
    SELECT c.id, c.card_number, c.title, c.progress, c.priority,
           c.due_date, c.start_date, c.planned_completion_date, c.actual_completion_date,
           c.column_id, col.name as column_name, col.color as column_color,
           p.id as project_id, p.name as project_name,
           COALESCE(
             (SELECT json_agg(json_build_object('id', pr.id, 'name', pr.name))
              FROM card_assignees ca JOIN profiles pr ON ca.user_id = pr.id
              WHERE ca.card_id = c.id), '[]') as assignees,
           COALESCE(
             (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
              FROM tags t JOIN card_tags ct ON t.id = ct.tag_id WHERE ct.card_id = c.id), '[]') as tags
    FROM cards c
    JOIN columns col ON c.column_id = col.id
    JOIN projects p ON col.project_id = p.id
    WHERE (c.is_archived = false OR c.is_archived IS NULL)
      AND (c.due_date IS NOT NULL
       OR c.planned_completion_date IS NOT NULL
       OR c.actual_completion_date IS NOT NULL)
    ORDER BY COALESCE(c.due_date, c.planned_completion_date, c.actual_completion_date)
  `)

  // Collect unique projects
  const projectMap = new Map<string, { id: string; name: string }>()
  for (const card of cards) {
    if (!projectMap.has(card.project_id)) {
      projectMap.set(card.project_id, { id: card.project_id, name: card.project_name })
    }
  }

  return {
    cards,
    projects: Array.from(projectMap.values()),
  }
}
