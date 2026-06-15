import { Body, Container, Html, Preview, Section, Text } from '@react-email/components'
import { EmailHead } from './email-head'
import { EmailHeader } from './email-header'
import { emailTheme } from './theme'

interface NewUserNotificationProps {
  name: string
  email: string
  timestamp: string
}

export function NewUserNotification({ name, email, timestamp }: NewUserNotificationProps) {
  return (
    <Html>
      <EmailHead />
      <Preview>New user signup: {email}</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader tagline='admin alert' />

          <Section style={hero}>
            <Text style={label}>NEW USER</Text>
            <Text style={headline}>{name}</Text>
            <Text style={subtext}>{email}</Text>
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

const hero = {
  padding: '60px 40px',
  textAlign: 'center' as const
}

const label = {
  fontSize: '11px',
  letterSpacing: '3px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0 0 20px',
  textTransform: 'uppercase' as const
}

const headline = {
  fontSize: '28px',
  fontWeight: '700',
  color: emailTheme.colors.mono.white,
  margin: '0 0 12px'
}

const subtext = {
  fontSize: '16px',
  lineHeight: '24px',
  color: emailTheme.colors.mono.textSecondary,
  margin: '0 0 16px',
  wordBreak: 'break-all' as const
}

const meta = {
  fontSize: '12px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0'
}

export default NewUserNotification
