export interface Portfolio {
  id: string
  name: string
  target_allocation: Record<string, number> | null
  created_at: string
}
