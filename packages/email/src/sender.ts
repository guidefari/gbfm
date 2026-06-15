import { render } from '@react-email/components'
import { Effect } from 'effect'
import React, { type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { sendTemplate } from './ses'

export interface EmailTemplate {
  subject: string
  component: ReactElement
}

export interface SendEmailOptions {
  to: string | string[]
  from?: string
  replyTo?: string
  template: EmailTemplate
}

export async function sendEmail({
  to,
  from = 'noreply',
  replyTo,
  template
}: SendEmailOptions): Promise<void> {
  Effect.logInfo('[Email] Starting template render', {
    subject: template.subject
  }).pipe(Effect.runPromise)

  let html: string
  try {
    // Try React Email render first
    html = await render(template.component)
    Effect.logInfo('[Email] React Email render successful', {
      htmlLength: html.length
    }).pipe(Effect.runPromise)
  } catch (error) {
    Effect.logWarning('[Email] React Email render failed, trying fallback', {
      error: error instanceof Error ? error.message : String(error)
    }).pipe(Effect.runPromise)

    // Fallback to React DOM server rendering
    try {
      html = renderToStaticMarkup(template.component)
      Effect.logInfo('[Email] React DOM fallback render successful', {
        htmlLength: html.length
      }).pipe(Effect.runPromise)
    } catch (fallbackError) {
      Effect.logError('[Email] Both React Email and React DOM rendering failed', {
        reactEmailError: error instanceof Error ? error.message : String(error),
        reactDomError:
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      }).pipe(Effect.runPromise)
      throw new Error(
        `Both React Email and React DOM rendering failed: ${error}, ${fallbackError}`,
        { cause: fallbackError }
      )
    }
  }

  Effect.logInfo('[Email] Template render complete', {
    htmlLength: html.length,
    hasDoctype: html.includes('<!DOCTYPE'),
    hasHtmlTag: html.includes('<html>')
  }).pipe(Effect.runPromise)

  await sendTemplate({
    from,
    to,
    subject: template.subject,
    html,
    ...(replyTo && { replyTo })
  })
}

export async function sendTestEmail({
  to,
  from = 'test'
}: {
  to: string | string[]
  from?: string
}): Promise<void> {
  const { TestEmail } = await import('../emails/test-email')

  await sendEmail({
    to,
    from,
    template: {
      subject: '🧪 Test Email from goosebumps.fm',
      component: React.createElement(TestEmail, { name: 'Developer' })
    }
  })
}

export async function sendWelcomeEmail({
  to,
  username,
  verificationUrl
}: {
  to: string
  username: string
  verificationUrl: string
}): Promise<void> {
  const { WelcomeEmail } = await import('../emails/welcome')

  await sendEmail({
    to,
    template: {
      subject: `Welcome to goosebumps.fm, ${username}, verify your email`,
      component: React.createElement(WelcomeEmail, {
        username,
        verificationUrl
      })
    }
  })
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  expiresIn = '1 hour'
}: {
  to: string
  resetUrl: string
  expiresIn?: string
}): Promise<void> {
  const { PasswordResetEmail } = await import('../emails/password-reset')

  await sendEmail({
    to,
    template: {
      subject: 'Reset your goosebumps.fm password',
      component: React.createElement(PasswordResetEmail, {
        resetUrl,
        expiresIn
      })
    }
  })
}

export async function sendMixNotificationEmail({
  to,
  username,
  mixTitle,
  artistName,
  mixUrl,
  coverImageUrl,
  releaseDate
}: {
  to: string | string[]
  username: string
  mixTitle: string
  artistName: string
  mixUrl: string
  coverImageUrl?: string | undefined
  releaseDate?: string | undefined
}): Promise<void> {
  const { NewMixNotification } = await import('../emails/new-mix-notification')

  await sendEmail({
    to,
    template: {
      subject: `New mix: ${mixTitle}`,
      component: React.createElement(NewMixNotification, {
        username,
        mixTitle,
        artistName,
        mixUrl,
        ...(coverImageUrl && { coverImageUrl }),
        ...(releaseDate && { releaseDate })
      })
    }
  })
}

export async function sendMusicReminderEmail({
  to,
  username,
  musicTitle,
  artistName,
  musicUrl,
  reminderDate,
  notes,
  albumCoverUrl
}: {
  to: string | string[]
  username: string
  musicTitle: string
  artistName: string
  musicUrl: string
  reminderDate: string
  notes?: string | null
  albumCoverUrl?: string | null
}): Promise<void> {
  const { MusicReminderEmail } = await import('../emails/music-reminder')

  await sendEmail({
    to,
    template: {
      subject: `🎵 Time to listen: ${musicTitle} by ${artistName}`,
      component: React.createElement(MusicReminderEmail, {
        username,
        musicTitle,
        artistName,
        musicUrl,
        reminderDate,
        ...(notes && { notes }),
        ...(albumCoverUrl && { albumCoverUrl })
      })
    }
  })
}

export async function sendInviteEmail({
  to,
  name,
  inviteUrl,
  role = 'user',
  expiresIn = '7 days'
}: {
  to: string
  name: string
  inviteUrl: string
  role?: string
  expiresIn?: string
}): Promise<void> {
  const { InviteEmail } = await import('../emails/invite')

  await sendEmail({
    to,
    template: {
      subject: "You've been invited to goosebumps.fm",
      component: React.createElement(InviteEmail, {
        name,
        inviteUrl,
        role,
        expiresIn
      })
    }
  })
}

export async function sendNewsletterUnsubscribeLinkEmail({
  to,
  unsubscribeUrl
}: {
  to: string
  unsubscribeUrl: string
}): Promise<void> {
  const { NewsletterUnsubscribeLink } = await import('../emails/newsletter-unsubscribe-link')

  await sendEmail({
    to,
    template: {
      subject: 'Your unsubscribe link',
      component: React.createElement(NewsletterUnsubscribeLink, {
        unsubscribeUrl
      })
    }
  })
}

export async function sendNewsletterWelcomeEmail({
  to,
  unsubscribeUrl
}: {
  to: string
  unsubscribeUrl: string
}): Promise<void> {
  const { NewsletterWelcomeEmail } = await import('../emails/newsletter-welcome')

  await sendEmail({
    to,
    template: {
      subject: "You're subscribed to goosebumps.fm",
      component: React.createElement(NewsletterWelcomeEmail, { unsubscribeUrl })
    }
  })
}

export async function sendNewsletterAdminNotificationEmail({
  to,
  event,
  email,
  timestamp = new Date().toISOString()
}: {
  to: string | string[]
  event: 'subscribed' | 'unsubscribed'
  email: string
  timestamp?: string
}): Promise<void> {
  const { NewsletterAdminNotification } = await import('../emails/newsletter-admin-notification')

  await sendEmail({
    to,
    template: {
      subject: event === 'subscribed' ? `New subscriber: ${email}` : `Unsubscribe: ${email}`,
      component: React.createElement(NewsletterAdminNotification, {
        event,
        email,
        timestamp
      })
    }
  })
}

export async function sendBackupNotificationEmail({
  to,
  status,
  timestamp,
  database,
  host,
  filename,
  fileSize,
  errorMessage,
  stackTrace,
  logContent,
  stage
}: {
  to: string | string[]
  status: 'success' | 'failure'
  timestamp?: string
  database?: string
  host?: string
  filename?: string
  fileSize?: string
  errorMessage?: string
  stackTrace?: string
  logContent?: string
  stage?: string
}): Promise<void> {
  const { BackupNotification } = await import('../emails/backup-notification')

  const subject =
    status === 'success'
      ? `✅ Database Backup Successful - ${stage?.toUpperCase() || 'DEV'}`
      : `❌ Database Backup Failed - ${stage?.toUpperCase() || 'DEV'}`

  const props: {
    status: 'success' | 'failure'
    timestamp?: string
    database?: string
    host?: string
    filename?: string
    fileSize?: string
    errorMessage?: string
    stackTrace?: string
    logContent?: string
    stage?: string
  } = {
    status,
    ...(timestamp && { timestamp }),
    ...(database && { database }),
    ...(host && { host }),
    ...(filename && { filename }),
    ...(fileSize && { fileSize }),
    ...(errorMessage && { errorMessage }),
    ...(stackTrace && { stackTrace }),
    ...(logContent && { logContent }),
    ...(stage && { stage })
  }

  await sendEmail({
    to,
    template: {
      subject,
      component: React.createElement(BackupNotification, props)
    }
  })
}
