import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  authorEmailPreferencesTable,
  type InsertAuthorEmailPreferences,
  type SelectAuthorEmailPreferences
} from '@/db/email.schema'

export class EmailPreferencesRepository {
  /**
   * Get email preferences for an author (creates default if not exists)
   */
  static async getOrCreateByAuthorId(
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

    // Create default preferences
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

    return newPreferences
  }

  /**
   * Update email preferences for an author
   */
  static async update(
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

  /**
   * Check if author can receive a specific email type
   */
  static async canReceiveEmail(
    authorId: string,
    emailType: 'MIX_RELEASE' | 'PROMOTIONAL' | 'SYSTEM' | 'TRANSACTIONAL'
  ): Promise<boolean> {
    // Transactional emails always get sent
    if (emailType === 'TRANSACTIONAL') {
      return true
    }

    const preferences =
      await EmailPreferencesRepository.getOrCreateByAuthorId(authorId)

    // Check global unsubscribe first
    if (preferences.globalUnsubscribe) {
      return false
    }

    // Check specific preference
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

  /**
   * Unsubscribe an author from all non-transactional emails
   */
  static async globalUnsubscribe(authorId: string) {
    return EmailPreferencesRepository.update(authorId, {
      globalUnsubscribe: true,
      mixReleaseEnabled: false,
      promotionalEnabled: false,
      systemEnabled: false
    })
  }

  /**
   * Get preferences by unsubscribe token
   */
  static async getByUnsubscribeToken(token: string) {
    const [preferences] = await db
      .select()
      .from(authorEmailPreferencesTable)
      .where(eq(authorEmailPreferencesTable.unsubscribeToken, token))
      .limit(1)
    return preferences
  }
}
