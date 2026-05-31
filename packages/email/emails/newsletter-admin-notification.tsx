import { Body, Container, Html, Preview, Section, Text } from '@react-email/components'
import { EmailHead } from './email-head'
import { emailTheme } from './theme'

interface NewsletterAdminNotificationProps {
  event: 'subscribed' | 'unsubscribed'
  email: string
  timestamp: string
}

export function NewsletterAdminNotification({
  event,
  email,
  timestamp
}: NewsletterAdminNotificationProps) {
  const isSubscribe = event === 'subscribed'
  return (
    <Html>
      <EmailHead />
      <Preview>{isSubscribe ? `New subscriber: ${email}` : `Unsubscribe: ${email}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={content}>
            <Text style={label}>{isSubscribe ? 'NEW SUBSCRIBER' : 'UNSUBSCRIBE'}</Text>
            <Text style={emailText}>{email}</Text>
            <Text style={meta}>{timestamp}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: emailTheme.colors.mono.page,
  fontFamily: emailTheme.typography.sansAlt
}

const container = {
  backgroundColor: emailTheme.colors.mono.page,
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px'
}

const content = {
  padding: '40px'
}

const label = {
  fontSize: '11px',
  letterSpacing: '3px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0 0 12px',
  textTransform: 'uppercase' as const
}

const emailText = {
  fontSize: '20px',
  fontWeight: '600',
  color: emailTheme.colors.mono.white,
  margin: '0 0 8px'
}

const meta = {
  fontSize: '12px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0'
}

export default NewsletterAdminNotification
