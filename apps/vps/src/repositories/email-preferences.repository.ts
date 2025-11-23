import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  authorEmailPreferencesTable,
  type InsertAuthorEmailPreferences,
  type SelectAuthorEmailPreferences
} from '@/db/email.schema'

export async function getOrCreateEmailPreferencesByAuthorId(
  authorId: string
): Promise<SelectAuthorEmailPreferences> {
  const [existing] = await db
    .select()
    .from(authorEmailPreferencesTable)
    .where(eq(authorEmailPreferencesTable.authorId, authorId))
    .limit(1)

  if (existing) {
    return existing
  }

  const [newPreferences] = await db
    .insert(authorEmailPreferencesTable)
    .values({
      authorId,
      mixReleaseEnabled: true,
      promotionalEnabled: true,
      systemEnabled: true,
      globalUnsubscribe: false,
      unsubscribeToken: crypto.randomUUID()
    })
    .returning()

  if (!newPreferences) {
    throw new Error('Failed to create email preferences')
  }

  return newPreferences
}

export async function updateEmailPreferences(
  authorId: string,
  updates: Partial<InsertAuthorEmailPreferences>
) {
  const [result] = await db
    .update(authorEmailPreferencesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(authorEmailPreferencesTable.authorId, authorId))
    .returning()
  return result
}

export async function canReceiveEmail(
  authorId: string,
  emailType: 'MIX_RELEASE' | 'PROMOTIONAL' | 'SYSTEM' | 'TRANSACTIONAL'
): Promise<boolean> {
  if (emailType === 'TRANSACTIONAL') {
    return true
  }

  const preferences = await getOrCreateEmailPreferencesByAuthorId(authorId)

  if (preferences.globalUnsubscribe) {
    return false
  }

  switch (emailType) {
    case 'MIX_RELEASE':
      return preferences.mixReleaseEnabled
    case 'PROMOTIONAL':
      return preferences.promotionalEnabled
    case 'SYSTEM':
      return preferences.systemEnabled
    default:
      return false
  }
}

export async function globalUnsubscribe(authorId: string) {
  return updateEmailPreferences(authorId, {
    globalUnsubscribe: true,
    mixReleaseEnabled: false,
    promotionalEnabled: false,
    systemEnabled: false
  })
}

export async function getEmailPreferencesByUnsubscribeToken(token: string) {
  const [preferences] = await db
    .select()
    .from(authorEmailPreferencesTable)
    .where(eq(authorEmailPreferencesTable.unsubscribeToken, token))
    .limit(1)
  return preferences
}
