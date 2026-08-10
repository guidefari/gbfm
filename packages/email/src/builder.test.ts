import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import React, { type ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import {
  buildInviteEmail,
  buildMusicReminderEmail,
  buildNewMixNotificationEmail,
  buildNewUserNotificationEmail,
  buildNewsletterAdminNotificationEmail,
  buildNewsletterUnsubscribeLinkEmail,
  buildNewsletterWelcomeEmail,
  buildPasswordResetEmail,
  buildTestEmail,
  buildWelcomeEmail,
  EmailRenderError,
  type RenderedEmail,
  renderEmail
} from './index'

const recipient = 'listener@example.com'
const replyTo = 'help@goosebumps.fm'
const sentAt = '2026-07-12T00:00:00.000Z'

async function render(message: Effect.Effect<RenderedEmail, EmailRenderError>) {
  return Effect.runPromise(message)
}

async function expectRenderedEmail(
  message: Effect.Effect<RenderedEmail, EmailRenderError>,
  subject: string,
  keyContent: string
) {
  const rendered = await render(message)

  expect(rendered.to).toBe(recipient)
  expect(rendered.replyTo).toBe(replyTo)
  expect(rendered.subject).toBe(subject)
  expect(rendered.html).not.toBe('')
  expect(rendered.text).toContain(keyContent)
}

describe('email builders', () => {
  it('keeps provider and infrastructure dependencies outside the template package', () => {
    const sourceDirectory = new URL('.', import.meta.url).pathname
    const packageDirectory = join(sourceDirectory, '..')
    const packageJson = readFileSync(join(packageDirectory, 'package.json'), 'utf8')

    expect(existsSync(join(sourceDirectory, 'sender.ts'))).toBe(false)
    expect(existsSync(join(sourceDirectory, 'ses.ts'))).toBe(false)
    expect(packageJson).not.toContain('@aws-sdk')
    expect(packageJson).not.toContain('"sst"')
  })

  it('builds the test email with the supplied sent time', async () => {
    expect.hasAssertions()
    await expectRenderedEmail(
      buildTestEmail({ to: recipient, replyTo, sentAt }),
      '🧪 Test Email from goosebumps.fm',
      `Sent at: ${sentAt}`
    )
  })

  it('builds the welcome email', async () => {
    expect.hasAssertions()
    await expectRenderedEmail(
      buildWelcomeEmail({
        to: recipient,
        replyTo,
        username: 'Listener',
        verificationUrl: 'https://goosebumps.fm/auth/verify-email?token=verify-token'
      }),
      'Welcome to goosebumps.fm, Listener, verify your email',
      'Welcome, Listener.'
    )
  })

  it('builds the password-reset email', async () => {
    expect.hasAssertions()
    await expectRenderedEmail(
      buildPasswordResetEmail({
        to: recipient,
        replyTo,
        resetUrl: 'https://goosebumps.fm/auth/reset-password?token=reset-token'
      }),
      'Reset your goosebumps.fm password',
      'This link expires in 1 hour and can only be used once.'
    )
  })

  it('builds the invitation email', async () => {
    expect.hasAssertions()
    await expectRenderedEmail(
      buildInviteEmail({
        to: recipient,
        replyTo,
        name: 'Listener',
        inviteUrl: 'https://goosebumps.fm/invite?token=invite-token'
      }),
      "You've been invited to goosebumps.fm",
      "You've been invited to join goosebumps.fm as a user."
    )
  })

  it('builds the music-reminder email', async () => {
    expect.hasAssertions()
    await expectRenderedEmail(
      buildMusicReminderEmail({
        to: recipient,
        replyTo,
        username: 'Listener',
        musicTitle: 'Night Drive',
        artistName: 'The Artists',
        musicUrl: 'https://goosebumps.fm/music/night-drive',
        reminderDate: 'July 12, 2026'
      }),
      '🎵 Time to listen: Night Drive by The Artists',
      'July 12, 2026'
    )
  })

  it('builds the new-mix notification email', async () => {
    expect.hasAssertions()
    await expectRenderedEmail(
      buildNewMixNotificationEmail({
        to: recipient,
        replyTo,
        username: 'Listener',
        mixTitle: 'Summer Mix',
        artistName: 'The Artists',
        mixUrl: 'https://goosebumps.fm/mixes/summer-mix',
        releaseDate: 'July 12, 2026'
      }),
      'New mix: Summer Mix',
      'Released July 12, 2026'
    )
  })

  it('builds the new-user notification email', async () => {
    expect.hasAssertions()
    await expectRenderedEmail(
      buildNewUserNotificationEmail({
        to: recipient,
        replyTo,
        name: 'Listener',
        email: recipient,
        timestamp: sentAt
      }),
      `New user signup: ${recipient}`,
      sentAt
    )
  })

  it('builds the newsletter admin notification email', async () => {
    expect.hasAssertions()
    await expectRenderedEmail(
      buildNewsletterAdminNotificationEmail({
        to: recipient,
        replyTo,
        event: 'subscribed',
        email: recipient,
        timestamp: sentAt
      }),
      `New subscriber: ${recipient}`,
      'NEW SUBSCRIBER'
    )
  })

  it('builds the newsletter unsubscribe-link email', async () => {
    expect.hasAssertions()
    await expectRenderedEmail(
      buildNewsletterUnsubscribeLinkEmail({
        to: recipient,
        replyTo,
        unsubscribeUrl: 'https://goosebumps.fm/unsubscribe?token=unsubscribe-token'
      }),
      'Your unsubscribe link',
      'You requested an unsubscribe link.'
    )
  })

  it('builds the newsletter welcome email', async () => {
    expect.hasAssertions()
    await expectRenderedEmail(
      buildNewsletterWelcomeEmail({
        to: recipient,
        replyTo,
        unsubscribeUrl: 'https://goosebumps.fm/unsubscribe?token=welcome-token'
      }),
      "You're subscribed to goosebumps.fm",
      "You're on the list."
    )
  })

  it('preserves verification, reset, and invitation URLs in HTML and text', async () => {
    const verificationUrl = 'https://goosebumps.fm/auth/verify-email?token=verify-token'
    const resetUrl = 'https://goosebumps.fm/auth/reset-password?token=reset-token'
    const inviteUrl = 'https://goosebumps.fm/invite?token=invite-token'
    const messages = await Promise.all([
      render(buildWelcomeEmail({ to: recipient, username: 'Listener', verificationUrl })),
      render(buildPasswordResetEmail({ to: recipient, resetUrl })),
      render(buildInviteEmail({ to: recipient, name: 'Listener', inviteUrl }))
    ])

    for (const [message, url] of [
      [messages[0], verificationUrl],
      [messages[1], resetUrl],
      [messages[2], inviteUrl]
    ] as const) {
      expect(message.html).toContain(url)
      expect(message.text).toContain(url)
    }
  })

  it('returns a typed render failure without exposing a renderer seam', async () => {
    function BrokenEmail(): ReactElement {
      throw new Error('renderer broke')
    }

    const outcome = await Effect.runPromise(
      Effect.match(
        renderEmail({
          templateName: 'test',
          to: recipient,
          subject: 'Broken email',
          component: React.createElement(BrokenEmail)
        }),
        {
          onFailure: (error) => error,
          onSuccess: () => undefined
        }
      )
    )

    expect(outcome).toBeInstanceOf(EmailRenderError)
    expect(outcome).toMatchObject({ _tag: 'EmailRenderError', templateName: 'test' })
    expect(JSON.stringify(outcome)).not.toContain('renderer broke')
    expect(JSON.stringify(outcome)).not.toContain(recipient)
    expect(JSON.stringify(outcome)).not.toContain('Broken email')
  })
})
