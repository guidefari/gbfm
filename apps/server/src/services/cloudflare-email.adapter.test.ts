import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  CloudflareEmailTransportLayer,
  type CloudflareEmailBinding,
  type CloudflareEmailMessage
} from '@/services/cloudflare-email.adapter'
import { EmailTransport, type OutboundEmailMessage } from '@/services/email-transport.service'

const outboundMessage: OutboundEmailMessage = {
  from: 'noreply@mail.goosebumps.fm',
  fromName: 'goosebumps.fm',
  to: 'listener@example.com',
  subject: 'Welcome',
  html: '<p>Welcome</p>',
  text: 'Welcome',
  replyTo: 'help@goosebumps.fm',
  templateName: 'welcome'
}

const send = (binding: CloudflareEmailBinding) =>
  Effect.gen(function* () {
    const transport = yield* EmailTransport
    return yield* transport.send(outboundMessage)
  }).pipe(Effect.provide(CloudflareEmailTransportLayer(binding)))

describe('CloudflareEmailTransportLayer', () => {
  test('translates a complete message through the public transport interface', async () => {
    const messages: CloudflareEmailMessage[] = []
    const binding: CloudflareEmailBinding = {
      send: async (message) => {
        messages.push(message)
        return { messageId: 'cf-1' }
      }
    }

    await expect(Effect.runPromise(send(binding))).resolves.toEqual({
      provider: 'cloudflare',
      messageId: 'cf-1'
    })
    expect(messages).toEqual([
      {
        from: { email: 'noreply@mail.goosebumps.fm', name: 'goosebumps.fm' },
        to: 'listener@example.com',
        subject: 'Welcome',
        html: '<p>Welcome</p>',
        text: 'Welcome',
        replyTo: 'help@goosebumps.fm'
      }
    ])
  })

  test.each([
    ['E_VALIDATION_ERROR', 'invalid-message'],
    ['E_FIELD_MISSING', 'invalid-message'],
    ['E_TOO_MANY_RECIPIENTS', 'invalid-message'],
    ['E_TOO_MANY_ATTACHMENTS', 'invalid-message'],
    ['E_CONTENT_TOO_LARGE', 'content-too-large'],
    ['E_SENDER_NOT_VERIFIED', 'sender-not-verified'],
    ['E_SENDER_DOMAIN_NOT_AVAILABLE', 'sender-not-verified'],
    ['E_RECIPIENT_NOT_ALLOWED', 'recipient-not-allowed'],
    ['E_RECIPIENT_SUPPRESSED', 'recipient-suppressed'],
    ['E_DELIVERY_FAILED', 'delivery-failed']
  ])('maps documented %s to the safe %s rejection category', async (code, reason) => {
    const binding: CloudflareEmailBinding = {
      send: async () => Promise.reject({ code })
    }

    const error = await Effect.runPromise(Effect.flip(send(binding)))

    expect(error).toMatchObject({ _tag: 'EmailRejected', reason, providerCode: code })
  })

  test('classifies unknown thrown values and empty receipts as unavailable without raw causes', async () => {
    const unavailableBinding: CloudflareEmailBinding = {
      send: async () =>
        Promise.reject({ code: 'E_PRIVATE_OUTAGE', message: 'recipient@example.com' })
    }
    const emptyReceiptBinding: CloudflareEmailBinding = {
      send: async () => ({ messageId: '  ' })
    }

    const unavailable = await Effect.runPromise(Effect.flip(send(unavailableBinding)))
    const invalidReceipt = await Effect.runPromise(Effect.flip(send(emptyReceiptBinding)))

    expect(unavailable).toMatchObject({ _tag: 'EmailUnavailable', providerCode: 'unknown' })
    expect(unavailable).not.toHaveProperty('cause')
    expect(invalidReceipt).toMatchObject({
      _tag: 'EmailUnavailable',
      providerCode: 'invalid-receipt'
    })
  })

  test('does not classify inherited properties such as toString as a provider code', async () => {
    const binding: CloudflareEmailBinding = {
      send: async () => Promise.reject({ code: 'toString' })
    }

    await expect(Effect.runPromise(Effect.flip(send(binding)))).resolves.toMatchObject({
      _tag: 'EmailUnavailable',
      providerCode: 'unknown'
    })
  })
})
