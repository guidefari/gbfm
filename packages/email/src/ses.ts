import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { Resource } from 'sst'

declare module 'sst' {
  interface Resource {
    Email: {
      configSet: string
      sender: string
      type: string
    }
  }
}

export const sesClient = new SESv2Client({})

export interface Attachment {
  filename: string
  content: string
  contentType?: string
}

export interface SendEmailProps {
  from: string
  to: string | string[]
  subject: string
  body: string
  attachments?: Attachment[]
}

export interface SendTemplateEmailProps {
  from: string
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: Attachment[]
}

export interface SimpleSendEmailOptions {
  source: string
  to: string[]
  subject: string
  html: string
}

export function getToAddresses(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to]
}

export function getFromAddress(from: string): string {
  return `${from}@${Resource.Email.sender}`
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildRawMessage({
  from,
  to,
  subject,
  html,
  text,
  attachments
}: SendTemplateEmailProps & { from: string; to: string[] }): string {
  const boundary = `boundary-${Date.now().toString(16)}`
  let content = [
    `From: goosebumps.fm <${from}>`,
    `To: ${to.join(', ')}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text || stripHtml(html),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    ''
  ]

  if (attachments && attachments.length > 0) {
    const mixedBoundary = `mixed-${Date.now().toString(16)}`
    content = [
      `From: goosebumps.fm <${from}>`,
      `To: ${to.join(', ')}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      '',
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      ...content.slice(4),
      `--${boundary}--`
    ]

    for (const attachment of attachments) {
      const contentType =
        attachment.contentType ||
        (attachment.filename.endsWith('.csv')
          ? 'text/csv'
          : 'application/octet-stream')
      content = content.concat([
        `--${mixedBoundary}`,
        `Content-Type: ${contentType}; name="${attachment.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        '',
        Buffer.from(attachment.content).toString('base64'),
        ''
      ])
    }

    content.push(`--${mixedBoundary}--`)
  } else {
    content.push(`--${boundary}--`)
  }

  return content.join('\r\n')
}

export async function send({
  from,
  to,
  subject,
  body,
  attachments
}: SendEmailProps): Promise<void> {
  const fromAddress = getFromAddress(from)
  const toAddresses = getToAddresses(to)

  if (attachments && attachments.length > 0) {
    const rawMessage = buildRawMessage({
      from: fromAddress,
      to: toAddresses,
      subject,
      html: `<html><body>${body}</body></html>`,
      text: body,
      attachments
    })

    await sesClient.send(
      new SendEmailCommand({
        Destination: { ToAddresses: toAddresses },
        FromEmailAddress: `goosebumps.fm <${fromAddress}>`,
        Content: {
          Raw: { Data: Buffer.from(rawMessage) }
        }
      })
    )
    return
  }

  await sesClient.send(
    new SendEmailCommand({
      Destination: { ToAddresses: toAddresses },
      FromEmailAddress: `goosebumps.fm <${fromAddress}>`,
      Content: {
        Simple: {
          Subject: { Data: subject },
          Body: { Text: { Data: body } }
        }
      }
    })
  )
}

export async function sendTemplate({
  from,
  to,
  subject,
  html,
  text,
  attachments
}: SendTemplateEmailProps): Promise<void> {
  const fromAddress = getFromAddress(from)
  const toAddresses = getToAddresses(to)

  const rawMessage = buildRawMessage({
    from: fromAddress,
    to: toAddresses,
    subject,
    html,
    text,
    attachments
  })

  await sesClient.send(
    new SendEmailCommand({
      Destination: { ToAddresses: toAddresses },
      FromEmailAddress: `goosebumps.fm <${fromAddress}>`,
      Content: {
        Raw: { Data: Buffer.from(rawMessage) }
      }
    })
  )
}

export async function sendSimpleEmail({
  source,
  to,
  subject,
  html
}: SimpleSendEmailOptions): Promise<void> {
  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: source,
      Destination: {
        ToAddresses: to
      },
      Content: {
        Simple: {
          Body: { Html: { Data: html } },
          Subject: { Data: subject }
        }
      }
    })
  )
}
