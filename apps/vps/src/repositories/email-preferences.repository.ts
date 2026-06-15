import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { user as userTable } from '@/db/auth.schema'
import {
  EMAIL_NOTIFICATION_TYPES,
  type EmailNotificationType,
  type InsertAuthorEmailPreferences,
  type SelectAuthorEmailPreferences,
  userEmailPreferencesTable
} from '@/db/email.schema'
import { newsletterSubscribersTable } from '@/db/newsletter.schema'

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

/**
 * Resolves whether an email address should receive a given notification type,
 * bridging the two opt-out systems: account preferences are the source of truth
 * when the email belongs to a user, otherwise the newsletter subscription state.
 */
export async function canEmailReceive(
  email: string,
  emailType: EmailNotificationType
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase()

  const [userRow] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, normalizedEmail))
    .limit(1)

  if (userRow) {
    return canReceiveEmail(userRow.id, emailType)
  }

  if (emailType === EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL) {
    return true
  }

  const [subscriber] = await db
    .select({ unsubscribedAt: newsletterSubscribersTable.unsubscribedAt })
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.email, normalizedEmail))
    .limit(1)

  return subscriber ? subscriber.unsubscribedAt === null : false
}

/**
 * Returns the deduped set of email addresses that should receive a mix-release
 * blast: active newsletter subscribers plus users whose preferences allow it.
 * Each address is opt-out filtered through the SSOT.
 */
export async function getActiveMixRecipients(): Promise<string[]> {
  const subscribers = await db
    .select({ email: newsletterSubscribersTable.email })
    .from(newsletterSubscribersTable)
    .where(isNull(newsletterSubscribersTable.unsubscribedAt))

  const optedInUsers = await db
    .select({ email: userTable.email })
    .from(userTable)
    .innerJoin(userEmailPreferencesTable, eq(userEmailPreferencesTable.userId, userTable.id))
    .where(
      and(
        eq(userEmailPreferencesTable.globalUnsubscribe, false),
        eq(userEmailPreferencesTable.mixReleaseEnabled, true)
      )
    )

  const emails = new Set<string>()
  for (const row of subscribers) emails.add(row.email.toLowerCase())
  for (const row of optedInUsers) emails.add(row.email.toLowerCase())

  const result: string[] = []
  for (const email of emails) {
    if (await canEmailReceive(email, EMAIL_NOTIFICATION_TYPES.MIX_RELEASE)) {
      result.push(email)
    }
  }
  return result
}
