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
