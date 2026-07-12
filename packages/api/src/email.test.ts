import { Exit, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import { EmailLogsQuery, EmailLogsResponse, SendMixNotificationInput } from './email'

describe('email API contract', () => {
  it('defaults pagination and trims the recipient filter', () => {
    expect(
      Schema.decodeUnknownSync(EmailLogsQuery)({ recipientEmail: '  listener@example.com  ' })
    ).toMatchObject({
      limit: 20,
      offset: 0,
      recipientEmail: 'listener@example.com'
    })
  })

  it('rejects a reversed date range', () => {
    const result = Schema.decodeUnknownExit(EmailLogsQuery)({
      dateFrom: '2026-07-12',
      dateTo: '2026-07-11'
    })

    expect(Exit.isFailure(result)).toBe(true)
  })

  it('keeps send payload validation at the shared boundary', () => {
    const result = Schema.decodeUnknownExit(SendMixNotificationInput)({
      recipients: ['listener@example.com'],
      mixSlug: 'summer-mix',
      metadata: { coverImageUrl: 'https://cdn.example.com/cover.jpg' }
    })

    expect(Exit.isSuccess(result)).toBe(true)
    expect(() => Schema.decodeUnknownSync(SendMixNotificationInput)({ mixSlug: '' })).toThrow()
  })

  it('accepts the serialized delivery-log response shape', () => {
    expect(
      Schema.decodeUnknownSync(EmailLogsResponse)({
        data: [
          {
            id: 'log-1',
            userId: null,
            recipientEmail: 'listener@example.com',
            recipientName: null,
            emailType: 'MIX_RELEASE',
            templateName: 'mix-notification',
            subject: 'New mix: Summer',
            status: 'SENT',
            sesMessageId: 'ses-1',
            metadata: { mixSlug: 'summer-mix' },
            errorMessage: null,
            sentAt: '2026-07-12T00:00:00.000Z',
            deliveredAt: null,
            bouncedAt: null,
            complainedAt: null,
            createdAt: '2026-07-12T00:00:00.000Z',
            updatedAt: '2026-07-12T00:00:00.000Z'
          }
        ],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false }
      })
    ).toBeTruthy()
  })
})
