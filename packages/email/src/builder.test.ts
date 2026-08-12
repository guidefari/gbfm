import { Effect } from 'effect'
import React, { type ReactElement } from 'react'
import { expect, test } from 'vitest'
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

test('builds the complete email catalog with the correct envelope and user-visible content', async () => {
  const verificationUrl = 'https://goosebumps.fm/auth/verify-email?token=verify-token'
  const resetUrl = 'https://goosebumps.fm/auth/reset-password?token=reset-token'
  const inviteUrl = 'https://goosebumps.fm/invite?token=invite-token'
  const unsubscribeUrl = 'https://goosebumps.fm/unsubscribe?token=unsubscribe-token'
  const newsletterWelcomeUrl = 'https://goosebumps.fm/unsubscribe?token=welcome-token'

  const [
    testEmail,
    welcomeEmail,
    passwordResetEmail,
    inviteEmail,
    musicReminderEmail,
    mixNotificationEmail,
    newUserNotificationEmail,
    newsletterAdminNotificationEmail,
    newsletterUnsubscribeLinkEmail,
    newsletterWelcomeEmail
  ] = await Promise.all([
    render(buildTestEmail({ to: recipient, replyTo, sentAt })),
    render(
      buildWelcomeEmail({
        to: recipient,
        replyTo,
        username: 'Listener',
        verificationUrl
      })
    ),
    render(buildPasswordResetEmail({ to: recipient, replyTo, resetUrl })),
    render(buildInviteEmail({ to: recipient, replyTo, name: 'Listener', inviteUrl })),
    render(
      buildMusicReminderEmail({
        to: recipient,
        replyTo,
        username: 'Listener',
        musicTitle: 'Night Drive',
        artistName: 'The Artists',
        musicUrl: 'https://goosebumps.fm/music/night-drive',
        reminderDate: 'July 12, 2026'
      })
    ),
    render(
      buildNewMixNotificationEmail({
        to: recipient,
        replyTo,
        username: 'Listener',
        mixTitle: 'Summer Mix',
        artistName: 'The Artists',
        mixUrl: 'https://goosebumps.fm/mixes/summer-mix',
        releaseDate: 'July 12, 2026'
      })
    ),
    render(
      buildNewUserNotificationEmail({
        to: recipient,
        replyTo,
        name: 'Listener',
        email: recipient,
        timestamp: sentAt
      })
    ),
    render(
      buildNewsletterAdminNotificationEmail({
        to: recipient,
        replyTo,
        event: 'subscribed',
        email: recipient,
        timestamp: sentAt
      })
    ),
    render(
      buildNewsletterUnsubscribeLinkEmail({
        to: recipient,
        replyTo,
        unsubscribeUrl
      })
    ),
    render(
      buildNewsletterWelcomeEmail({
        to: recipient,
        replyTo,
        unsubscribeUrl: newsletterWelcomeUrl
      })
    )
  ])

  const messages = [
    testEmail,
    welcomeEmail,
    passwordResetEmail,
    inviteEmail,
    musicReminderEmail,
    mixNotificationEmail,
    newUserNotificationEmail,
    newsletterAdminNotificationEmail,
    newsletterUnsubscribeLinkEmail,
    newsletterWelcomeEmail
  ]

  expect(
    messages.map(({ templateName, to, replyTo: messageReplyTo, subject }) => ({
      templateName,
      to,
      replyTo: messageReplyTo,
      subject
    }))
  ).toEqual([
    {
      templateName: 'test',
      to: recipient,
      replyTo,
      subject: '🧪 Test Email from goosebumps.fm'
    },
    {
      templateName: 'welcome',
      to: recipient,
      replyTo,
      subject: 'Welcome to goosebumps.fm, Listener, verify your email'
    },
    {
      templateName: 'password-reset',
      to: recipient,
      replyTo,
      subject: 'Reset your goosebumps.fm password'
    },
    {
      templateName: 'invite',
      to: recipient,
      replyTo,
      subject: "You've been invited to goosebumps.fm"
    },
    {
      templateName: 'music-reminder',
      to: recipient,
      replyTo,
      subject: '🎵 Time to listen: Night Drive by The Artists'
    },
    {
      templateName: 'mix-notification',
      to: recipient,
      replyTo,
      subject: 'New mix: Summer Mix'
    },
    {
      templateName: 'new-user-notification',
      to: recipient,
      replyTo,
      subject: `New user signup: ${recipient}`
    },
    {
      templateName: 'newsletter-admin-notification',
      to: recipient,
      replyTo,
      subject: `New subscriber: ${recipient}`
    },
    {
      templateName: 'newsletter-unsubscribe-link',
      to: recipient,
      replyTo,
      subject: 'Your unsubscribe link'
    },
    {
      templateName: 'newsletter-welcome',
      to: recipient,
      replyTo,
      subject: "You're subscribed to goosebumps.fm"
    }
  ])

  for (const message of messages) expect(message.html).not.toBe('')

  for (const [message, content] of [
    [testEmail, `Sent at: ${sentAt}`],
    [welcomeEmail, 'Welcome, Listener.'],
    [passwordResetEmail, 'This link expires in 1 hour and can only be used once.'],
    [inviteEmail, "You've been invited to join goosebumps.fm as a user."],
    [musicReminderEmail, 'July 12, 2026'],
    [mixNotificationEmail, 'Released July 12, 2026'],
    [newUserNotificationEmail, sentAt],
    [newsletterAdminNotificationEmail, 'NEW SUBSCRIBER'],
    [newsletterUnsubscribeLinkEmail, 'You requested an unsubscribe link.'],
    [newsletterWelcomeEmail, "You're on the list."]
  ] as const) {
    expect(message.text).toContain(content)
  }

  for (const [message, url] of [
    [welcomeEmail, verificationUrl],
    [passwordResetEmail, resetUrl],
    [inviteEmail, inviteUrl]
  ] as const) {
    expect(message.html).toContain(url)
    expect(message.text).toContain(url)
  }
})

test('returns a typed render failure without leaking renderer or recipient details', async () => {
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
