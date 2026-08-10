import { describe, expect, test } from 'vitest'
import { applyD1Migrations, createMigratedD1Database } from '@/test/migrate-d1'

describe('email provider receipt migration', () => {
  test('preserves historical SES IDs as provider-neutral receipts and removes the SES column', async () => {
    const d1 = await createMigratedD1Database([
      '0000_public_thunderbolt.sql',
      '0001_search_fts.sql'
    ])
    await d1
      .prepare(
        `INSERT INTO email_delivery_logs (
          id, recipientEmail, emailType, templateName, subject, status,
          sesMessageId, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'historical-ses-log',
        'listener@example.com',
        'TRANSACTIONAL',
        'welcome',
        'Welcome',
        'SENT',
        'ses-message-1',
        0,
        0
      )
      .run()

    await applyD1Migrations(d1, ['0002_email_provider_receipt.sql'])

    const receipt = await d1
      .prepare('SELECT provider, providerMessageId FROM email_delivery_logs WHERE id = ?')
      .bind('historical-ses-log')
      .first<{ provider: string; providerMessageId: string }>()
    const columns = await d1
      .prepare('PRAGMA table_info(email_delivery_logs)')
      .all<{ name: string }>()

    expect(receipt).toEqual({ provider: 'ses', providerMessageId: 'ses-message-1' })
    expect(columns.results.map((column) => column.name)).not.toContain('sesMessageId')
  })

  test('keeps a null historical SES ID as a null neutral receipt', async () => {
    const d1 = await createMigratedD1Database([
      '0000_public_thunderbolt.sql',
      '0001_search_fts.sql'
    ])
    await d1
      .prepare(
        `INSERT INTO email_delivery_logs (
          id, recipientEmail, emailType, templateName, subject, status,
          sesMessageId, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'historical-null-ses-log',
        'listener@example.com',
        'TRANSACTIONAL',
        'welcome',
        'Welcome',
        'PENDING',
        null,
        0,
        0
      )
      .run()

    await applyD1Migrations(d1, ['0002_email_provider_receipt.sql'])

    const receipt = await d1
      .prepare('SELECT provider, providerMessageId FROM email_delivery_logs WHERE id = ?')
      .bind('historical-null-ses-log')
      .first<{ provider: string | null; providerMessageId: string | null }>()

    expect(receipt).toEqual({ provider: null, providerMessageId: null })
  })
})
