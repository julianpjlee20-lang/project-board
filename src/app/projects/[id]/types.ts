export type ViewType = 'board' | 'list' | 'calendar' | 'progress'

export interface Card {
  id: string
  title: string
  description: string | null
  due_date: string | null
  progress: number
  assignees: { id: string; name: string }[]
  tags: { id: string; name: string; color: string }[]
  subtasks: { id: string; title: string; is_completed: boolean }[]
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
