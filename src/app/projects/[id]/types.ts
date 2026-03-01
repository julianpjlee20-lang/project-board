export type ViewType = 'board' | 'list' | 'calendar' | 'progress'

export type CalendarMode = 'month' | 'quarter' | 'year'

export interface Card {
  id: string
  title: string
  description: string | null
  due_date: string | null
  progress: number
  priority: 'low' | 'medium' | 'high'
  phase_id: string | null
  planned_completion_date: string | null
  actual_completion_date: string | null
  created_at?: string
  assignees: { id: string; name: string }[]
  tags: { id: string; name: string; color: string }[]
  subtasks: { id: string; title: string; is_completed: boolean }[]
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
