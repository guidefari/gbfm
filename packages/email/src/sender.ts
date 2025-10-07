import { render } from '@react-email/components'
import React, { type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getFromAddress, sendSimpleEmail, sendTemplate } from './ses'

export interface EmailTemplate {
  subject: string
  component: ReactElement
}

export interface SendEmailOptions {
  to: string | string[]
  from?: string
  template: EmailTemplate
}

export async function sendEmail({
  to,
  from = 'noreply',
  template
}: SendEmailOptions): Promise<void> {
  console.log('🔍 Debug: About to render component:', template.component)

  let html: string
  try {
    // Try React Email render first
    html = await render(template.component)
    console.log('✅ React Email render worked, HTML length:', html.length)
  } catch (error) {
    console.log('❌ React Email render failed:', error)
    console.log('🔄 Falling back to React DOM server rendering...')

    // Fallback to React DOM server rendering
    try {
      html = renderToStaticMarkup(template.component)
      console.log(
        '✅ React DOM server render worked, HTML length:',
        html.length
      )
    } catch (fallbackError) {
      console.log('❌ React DOM server render also failed:', fallbackError)
      throw new Error(
        `Both React Email and React DOM rendering failed: ${error}, ${fallbackError}`
      )
    }
  }

  console.log(
    '🔍 Debug: First 200 chars of rendered HTML:',
    html.substring(0, 200)
  )
  console.log('🔍 Debug: HTML contains DOCTYPE?', html.includes('<!DOCTYPE'))
  console.log('🔍 Debug: HTML contains <html>?', html.includes('<html'))

  await sendTemplate({
    from,
    to,
    subject: template.subject,
    html
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
  loginUrl
}: {
  to: string
  username: string
  loginUrl?: string
}): Promise<void> {
  const { WelcomeEmail } = await import('../emails/welcome')

  await sendEmail({
    to,
    template: {
      subject: `Welcome to goosebumps.fm, ${username}! 🎵`,
      component: React.createElement(WelcomeEmail, { username, loginUrl })
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
