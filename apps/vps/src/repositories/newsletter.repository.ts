import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { newsletterSubscribersTable } from '@/db/newsletter.schema'

/**
 * Ensures a newsletter subscriber row exists for a freshly created user and links
 * it to them. If the email previously unsubscribed as an anonymous subscriber, that
 * state is reported so the caller can carry it into the user's email preferences.
 */
export async function linkOrCreateSubscriberForUser(params: {
  userId: string
  email: string
  name?: string | null
}): Promise<{ previouslyUnsubscribed: boolean }> {
  const normalizedEmail = params.email.trim().toLowerCase()

  const [existing] = await db
    .select({
      id: newsletterSubscribersTable.id,
      unsubscribedAt: newsletterSubscribersTable.unsubscribedAt
    })
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.email, normalizedEmail))
    .limit(1)

  if (existing) {
    await db
      .update(newsletterSubscribersTable)
      .set({ userId: params.userId, updatedAt: new Date() })
      .where(eq(newsletterSubscribersTable.id, existing.id))
    return { previouslyUnsubscribed: existing.unsubscribedAt !== null }
  }

  await db.insert(newsletterSubscribersTable).values({
    email: normalizedEmail,
    userId: params.userId,
    source: 'signup',
    ...(params.name && { name: params.name.trim() })
  })

  return { previouslyUnsubscribed: false }
}

export async function markSubscriberUnsubscribedByUserId(userId: string): Promise<void> {
  await db
    .update(newsletterSubscribersTable)
    .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
    .where(eq(newsletterSubscribersTable.userId, userId))
}

export async function getSubscriberByUnsubscribeToken(token: string) {
  const [subscriber] = await db
    .select()
    .from(newsletterSubscribersTable)
    .where(eq(newsletterSubscribersTable.unsubscribeToken, token))
    .limit(1)
  return subscriber
}
