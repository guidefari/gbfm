export const NEW_MIX_WINDOW_DAYS = 7
export const RECENT_MIX_WINDOW_DAYS = 30

export type MixRecencyLabel = 'new' | 'recent' | null

export function getMixRecencyLabel(createdAt: string | Date, now = Date.now()): MixRecencyLabel {
  const timestamp = new Date(createdAt).getTime()
  if (Number.isNaN(timestamp)) return null

  const ageInMs = now - timestamp
  if (ageInMs < 0) return 'new'

  const ageInDays = ageInMs / (1000 * 60 * 60 * 24)

  if (ageInDays <= NEW_MIX_WINDOW_DAYS) return 'new'
  if (ageInDays <= RECENT_MIX_WINDOW_DAYS) return 'recent'
  return null
}
