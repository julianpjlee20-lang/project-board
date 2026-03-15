export type ViewType = 'board' | 'list' | 'calendar' | 'progress' | 'gantt'

export type CalendarMode = 'month' | 'quarter' | 'year'

export type GanttScale = 'week' | 'month'

export interface Card {
  id: string
  card_number: number | null
  title: string
  description: string | null
  start_date: string | null
  due_date: string | null
  progress: number
  priority: 'low' | 'medium' | 'high'
  phase_id: string | null
  planned_completion_date: string | null
  actual_completion_date: string | null
  created_at?: string
  assignees: { id: string; name: string }[]
  tags: { id: string; name: string; color: string }[]
  rolling_due_date: boolean
  is_archived: boolean
  archived_at: string | null
  subtasks: Subtask[]
}

export interface Subtask {
  id: string
  title: string
  is_completed: boolean
  due_date: string | null
  assignee_id: string | null
  assignee_name: string | null
}

export interface Phase {
  id: string
  name: string
  color: string
  position: number
  total_cards: number
  completed_cards: number
  progress: number
}

export interface Column {
  id: string
  name: string
  color: string
  cards: Card[]
}

export interface Project {
  id: string
  name: string
}

export interface ActivityLog {
  id: string
  action: string
  target: string
  old_value: string
  new_value: string
  created_at: string
}

export interface CardDetailProps {
  card: Card
  phases: Phase[]
  onClose: () => void
  onUpdate: () => void
}

export interface ActiveUser {
  id: string
  name: string
  avatar_url: string | null
}

export interface CardTemplate {
  id: string
  project_id: string
  name: string
  title_pattern: string
  description: string | null
  priority: 'low' | 'medium' | 'high'
  target_column_id: string | null
  rolling_due_date: boolean
  created_at: string
  subtasks: TemplateSubtask[]
}

export interface TemplateSubtask {
  id: string
  title: string
  position: number
  day_of_month: number | null
  assignee_id: string | null
  assignee_name: string | null
}

/** 計算到截止日的天數差（正數=還有幾天，負數=逾期幾天） */
export function getDaysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

/** 子任務緊急度等級 */
export type UrgencyLevel = 'overdue' | 'today' | 'soon' | 'upcoming' | 'normal' | null

/** 取得卡片中未完成子任務的最高緊急度 */
export function getSubtaskUrgency(subtasks: Subtask[]): {
  level: UrgencyLevel
  days: number | null
  urgentCount: number
} {
  const withDates = subtasks.filter(s => s.due_date && !s.is_completed)
  if (withDates.length === 0) return { level: null, days: null, urgentCount: 0 }

  let worstDays = Infinity
  let urgentCount = 0

  for (const s of withDates) {
    const days = getDaysUntil(s.due_date!)
    if (days < worstDays) worstDays = days
    if (days <= 3) urgentCount++
  }

  let level: UrgencyLevel = 'normal'
  if (worstDays < 0) level = 'overdue'
  else if (worstDays === 0) level = 'today'
  else if (worstDays <= 3) level = 'soon'
  else if (worstDays <= 7) level = 'upcoming'

  return { level, days: worstDays, urgentCount }
}

/** 當卡片沒有手動設定截止日時，從子任務衍生截止日 */
export function getDerivedDueDate(subtasks: Subtask[]): string | null {
  const withDates = subtasks.filter(s => s.due_date)
  if (withDates.length === 0) return null
  const uncompleted = withDates.filter(s => !s.is_completed)
  if (uncompleted.length > 0) {
    return uncompleted.map(s => s.due_date!).sort()[0]
  }
  return withDates.map(s => s.due_date!).sort().reverse()[0]
}
