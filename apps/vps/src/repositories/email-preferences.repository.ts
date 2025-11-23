import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  EMAIL_NOTIFICATION_TYPES,
  type EmailNotificationType,
  type InsertAuthorEmailPreferences,
  type SelectAuthorEmailPreferences,
  userEmailPreferencesTable
} from '@/db/email.schema'

export async function getOrCreateEmailPreferencesByUserId(
  userId: string
): Promise<SelectAuthorEmailPreferences> {
  const [existing] = await db
    .select()
    .from(userEmailPreferencesTable)
    .where(eq(userEmailPreferencesTable.userId, userId))
    .limit(1)

  if (existing) {
    return existing
  }

  const [newPreferences] = await db
    .insert(userEmailPreferencesTable)
    .values({
      userId: userId,
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
  userId: string,
  updates: Partial<InsertAuthorEmailPreferences>
) {
  const [result] = await db
    .update(userEmailPreferencesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userEmailPreferencesTable.userId, userId))
    .returning()
  return result
}

export async function canReceiveEmail(
  userId: string,
  emailType: EmailNotificationType
): Promise<boolean> {
  if (emailType === EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL) {
    return true
  }

  const preferences = await getOrCreateEmailPreferencesByUserId(userId)

  if (preferences.globalUnsubscribe) {
    return false
  }

  switch (emailType) {
    case EMAIL_NOTIFICATION_TYPES.MIX_RELEASE:
      return preferences.mixReleaseEnabled
    case EMAIL_NOTIFICATION_TYPES.PROMOTIONAL:
      return preferences.promotionalEnabled
    case EMAIL_NOTIFICATION_TYPES.SYSTEM:
      return preferences.systemEnabled
    default:
      return false
  }
}

export async function globalUnsubscribe(userId: string) {
  return updateEmailPreferences(userId, {
    globalUnsubscribe: true,
    mixReleaseEnabled: false,
    promotionalEnabled: false,
    systemEnabled: false
  })
}

export async function getEmailPreferencesByUnsubscribeToken(token: string) {
  const [preferences] = await db
    .select()
    .from(userEmailPreferencesTable)
    .where(eq(userEmailPreferencesTable.unsubscribeToken, token))
    .limit(1)
  return preferences
}
