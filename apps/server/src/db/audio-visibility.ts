import { eq, or } from 'drizzle-orm'

import { audioTable } from './audio.schema'
import { audioIdsForCreator } from './creator-membership'
import type { Database } from './layer'

export interface AudioViewer {
  readonly userId: string
  readonly userRole: string
}

export const audioVisibilityCondition = (db: Database['Service'], viewer?: AudioViewer) => {
  if (viewer?.userRole === 'admin') return undefined

  if (viewer) return or(eq(audioTable.draft, false), audioIdsForCreator(db, viewer.userId))

  return eq(audioTable.draft, false)
}
