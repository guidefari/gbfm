import { Effect } from 'effect'
import React from 'react'
import { InviteEmail } from '../emails/invite'
import { MusicReminderEmail } from '../emails/music-reminder'
import { NewMixNotification } from '../emails/new-mix-notification'
import { NewUserNotification } from '../emails/new-user-notification'
import { NewsletterAdminNotification } from '../emails/newsletter-admin-notification'
import { NewsletterUnsubscribeLink } from '../emails/newsletter-unsubscribe-link'
import { NewsletterWelcomeEmail } from '../emails/newsletter-welcome'
import { PasswordResetEmail } from '../emails/password-reset'
import { TestEmail } from '../emails/test-email'
import { WelcomeEmail } from '../emails/welcome'
import type { RenderedEmail } from './message'
import { EmailRenderError, renderEmail } from './render'

/** The addressing fields shared by every email builder. */
export interface EmailRecipientInput {
  /** The sole recipient of the rendered email. */
  readonly to: string
  /** The optional address to which recipients can reply. */
  readonly replyTo?: string | undefined
}

/** Input for the development test-email builder. */
export interface BuildTestEmailInput extends EmailRecipientInput {
  /** The name shown in the email. */
  readonly name?: string
  /** The test message body. */
  readonly message?: string
  /** The time displayed in the email. */
  readonly sentAt: string
}

/** Builds the development test email without sending it. */
export function buildTestEmail(
  input: BuildTestEmailInput
): Effect.Effect<RenderedEmail<'test'>, EmailRenderError> {
  const componentProperties = { sentAt: input.sentAt }
  if (input.name !== undefined) Object.assign(componentProperties, { name: input.name })
  if (input.message !== undefined) Object.assign(componentProperties, { message: input.message })

  return renderEmail({
    templateName: 'test',
    to: input.to,
    replyTo: input.replyTo,
    subject: '🧪 Test Email from goosebumps.fm',
    component: React.createElement(TestEmail, componentProperties)
  })
}

/** Input for the welcome-email builder. */
export interface BuildWelcomeEmailInput extends EmailRecipientInput {
  /** The recipient's username. */
  readonly username: string
  /** The account-verification URL. */
  readonly verificationUrl: string
}

/** Builds the welcome email without sending it. */
export function buildWelcomeEmail(
  input: BuildWelcomeEmailInput
): Effect.Effect<RenderedEmail<'welcome'>, EmailRenderError> {
  return renderEmail({
    templateName: 'welcome',
    to: input.to,
    replyTo: input.replyTo,
    subject: `Welcome to goosebumps.fm, ${input.username}, verify your email`,
    component: React.createElement(WelcomeEmail, {
      username: input.username,
      verificationUrl: input.verificationUrl
    })
  })
}

/** Input for the password-reset-email builder. */
export interface BuildPasswordResetEmailInput extends EmailRecipientInput {
  /** The password-reset URL. */
  readonly resetUrl: string
  /** How long the reset URL remains valid. */
  readonly expiresIn?: string
}

/** Builds the password reset email without sending it. */
export function buildPasswordResetEmail(
  input: BuildPasswordResetEmailInput
): Effect.Effect<RenderedEmail<'password-reset'>, EmailRenderError> {
  const componentProperties = { resetUrl: input.resetUrl }
  if (input.expiresIn !== undefined) {
    Object.assign(componentProperties, { expiresIn: input.expiresIn })
  }

  return renderEmail({
    templateName: 'password-reset',
    to: input.to,
    replyTo: input.replyTo,
    subject: 'Reset your goosebumps.fm password',
    component: React.createElement(PasswordResetEmail, componentProperties)
  })
}

/** Input for the invitation-email builder. */
export interface BuildInviteEmailInput extends EmailRecipientInput {
  /** The invitee's name. */
  readonly name: string
  /** The invitation URL. */
  readonly inviteUrl: string
  /** The role assigned by the invitation. */
  readonly role?: string
  /** How long the invitation remains valid. */
  readonly expiresIn?: string
}

/** Builds the invitation email without sending it. */
export function buildInviteEmail(
  input: BuildInviteEmailInput
): Effect.Effect<RenderedEmail<'invite'>, EmailRenderError> {
  const componentProperties = { name: input.name, inviteUrl: input.inviteUrl }
  if (input.role !== undefined) Object.assign(componentProperties, { role: input.role })
  if (input.expiresIn !== undefined) {
    Object.assign(componentProperties, { expiresIn: input.expiresIn })
  }

  return renderEmail({
    templateName: 'invite',
    to: input.to,
    replyTo: input.replyTo,
    subject: "You've been invited to goosebumps.fm",
    component: React.createElement(InviteEmail, componentProperties)
  })
}

/** Input for the music-reminder-email builder. */
export interface BuildMusicReminderEmailInput extends EmailRecipientInput {
  /** The recipient's username. */
  readonly username: string
  /** The music title. */
  readonly musicTitle: string
  /** The artist name. */
  readonly artistName: string
  /** The music URL. */
  readonly musicUrl: string
  /** The formatted reminder date. */
  readonly reminderDate: string
  /** Optional user-authored reminder notes. */
  readonly notes?: string | null
  /** Optional album-cover URL. */
  readonly albumCoverUrl?: string | null
}

/** Builds the music reminder email without sending it. */
export function buildMusicReminderEmail(
  input: BuildMusicReminderEmailInput
): Effect.Effect<RenderedEmail<'music-reminder'>, EmailRenderError> {
  const componentProperties = {
    username: input.username,
    musicTitle: input.musicTitle,
    artistName: input.artistName,
    musicUrl: input.musicUrl,
    reminderDate: input.reminderDate
  }
  if (input.notes !== null && input.notes !== undefined) {
    Object.assign(componentProperties, { notes: input.notes })
  }
  if (input.albumCoverUrl !== null && input.albumCoverUrl !== undefined) {
    Object.assign(componentProperties, { albumCoverUrl: input.albumCoverUrl })
  }

  return renderEmail({
    templateName: 'music-reminder',
    to: input.to,
    replyTo: input.replyTo,
    subject: `🎵 Time to listen: ${input.musicTitle} by ${input.artistName}`,
    component: React.createElement(MusicReminderEmail, componentProperties)
  })
}

/** Input for the mix-notification-email builder. */
export interface BuildNewMixNotificationEmailInput extends EmailRecipientInput {
  /** The recipient's username. */
  readonly username: string
  /** The mix title. */
  readonly mixTitle: string
  /** The artist name. */
  readonly artistName: string
  /** The mix URL. */
  readonly mixUrl: string
  /** Optional cover-image URL. */
  readonly coverImageUrl?: string
  /** The formatted release date. */
  readonly releaseDate?: string
}

/** Builds the new-mix notification email without sending it. */
export function buildNewMixNotificationEmail(
  input: BuildNewMixNotificationEmailInput
): Effect.Effect<RenderedEmail<'mix-notification'>, EmailRenderError> {
  const componentProperties = {
    username: input.username,
    mixTitle: input.mixTitle,
    artistName: input.artistName,
    mixUrl: input.mixUrl
  }
  if (input.coverImageUrl !== undefined) {
    Object.assign(componentProperties, { coverImageUrl: input.coverImageUrl })
  }
  if (input.releaseDate !== undefined) {
    Object.assign(componentProperties, { releaseDate: input.releaseDate })
  }

  return renderEmail({
    templateName: 'mix-notification',
    to: input.to,
    replyTo: input.replyTo,
    subject: `New mix: ${input.mixTitle}`,
    component: React.createElement(NewMixNotification, componentProperties)
  })
}

/** Input for the new-user-notification-email builder. */
export interface BuildNewUserNotificationEmailInput extends EmailRecipientInput {
  /** The new user's name. */
  readonly name: string
  /** The new user's email address. */
  readonly email: string
  /** The signup time displayed in the email. */
  readonly timestamp: string
}

/** Builds the new-user notification email without sending it. */
export function buildNewUserNotificationEmail(
  input: BuildNewUserNotificationEmailInput
): Effect.Effect<RenderedEmail<'new-user-notification'>, EmailRenderError> {
  return renderEmail({
    templateName: 'new-user-notification',
    to: input.to,
    replyTo: input.replyTo,
    subject: `New user signup: ${input.email}`,
    component: React.createElement(NewUserNotification, {
      name: input.name,
      email: input.email,
      timestamp: input.timestamp
    })
  })
}

/** Input for the newsletter-admin-notification-email builder. */
export interface BuildNewsletterAdminNotificationEmailInput extends EmailRecipientInput {
  /** Whether the subscriber joined or left the newsletter. */
  readonly event: 'subscribed' | 'unsubscribed'
  /** The subscriber's email address. */
  readonly email: string
  /** The event time displayed in the email. */
  readonly timestamp: string
}

/** Builds the newsletter admin notification email without sending it. */
export function buildNewsletterAdminNotificationEmail(
  input: BuildNewsletterAdminNotificationEmailInput
): Effect.Effect<RenderedEmail<'newsletter-admin-notification'>, EmailRenderError> {
  return renderEmail({
    templateName: 'newsletter-admin-notification',
    to: input.to,
    replyTo: input.replyTo,
    subject:
      input.event === 'subscribed'
        ? `New subscriber: ${input.email}`
        : `Unsubscribe: ${input.email}`,
    component: React.createElement(NewsletterAdminNotification, {
      event: input.event,
      email: input.email,
      timestamp: input.timestamp
    })
  })
}

/** Input for the newsletter-unsubscribe-link-email builder. */
export interface BuildNewsletterUnsubscribeLinkEmailInput extends EmailRecipientInput {
  /** The unsubscribe URL. */
  readonly unsubscribeUrl: string
}

/** Builds the newsletter unsubscribe-link email without sending it. */
export function buildNewsletterUnsubscribeLinkEmail(
  input: BuildNewsletterUnsubscribeLinkEmailInput
): Effect.Effect<RenderedEmail<'newsletter-unsubscribe-link'>, EmailRenderError> {
  return renderEmail({
    templateName: 'newsletter-unsubscribe-link',
    to: input.to,
    replyTo: input.replyTo,
    subject: 'Your unsubscribe link',
    component: React.createElement(NewsletterUnsubscribeLink, {
      unsubscribeUrl: input.unsubscribeUrl
    })
  })
}

/** Input for the newsletter-welcome-email builder. */
export interface BuildNewsletterWelcomeEmailInput extends EmailRecipientInput {
  /** The unsubscribe URL. */
  readonly unsubscribeUrl: string
}

/** Builds the newsletter welcome email without sending it. */
export function buildNewsletterWelcomeEmail(
  input: BuildNewsletterWelcomeEmailInput
): Effect.Effect<RenderedEmail<'newsletter-welcome'>, EmailRenderError> {
  return renderEmail({
    templateName: 'newsletter-welcome',
    to: input.to,
    replyTo: input.replyTo,
    subject: "You're subscribed to goosebumps.fm",
    component: React.createElement(NewsletterWelcomeEmail, {
      unsubscribeUrl: input.unsubscribeUrl
    })
  })
}
