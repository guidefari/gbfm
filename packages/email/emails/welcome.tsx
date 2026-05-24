import {
  Body,
  Button,
  Container,
  Html,
  Link,
  Preview,
  Section,
  Text
} from '@react-email/components'
import { EmailHead } from './email-head'
import { EmailHeader } from './email-header'
import { emailTheme } from './theme'

interface WelcomeEmailProps {
  username: string
  verificationUrl: string
}

export function WelcomeEmail({
  username = 'John Doe',
  verificationUrl = 'https://goosebumps.fm/auth/verify-email'
}: WelcomeEmailProps) {
  return (
    <Html>
      <EmailHead />
      <Preview>
        Welcome to goosebumps.fm, {username}. Verify your email to get started.
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader tagline='welcome' />

          <Section style={hero}>
            <Text style={label}>NEW ACCOUNT</Text>
            <Text style={headline}>Welcome, {username}.</Text>
            <Text style={subtext}>
              Confirm your email so you can save favourites, follow people, and
              pick up where you left off.
            </Text>
            <Button style={ctaButton} href={verificationUrl}>
              Verify your email
            </Button>
            <Text style={fallback}>
              Button not working?{' '}
              <Link href={verificationUrl} style={fallbackLink}>
                Copy this link
              </Link>
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              <Link href='https://goosebumps.fm' style={footerLink}>
                goosebumps.fm
              </Link>
            </Text>
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
  margin: '0 0 16px'
}

const subtext = {
  fontSize: '16px',
  lineHeight: '24px',
  color: emailTheme.colors.mono.textSecondary,
  margin: '0 0 32px'
}

const ctaButton = {
  backgroundColor: emailTheme.colors.mono.white,
  color: emailTheme.colors.mono.black,
  fontSize: '14px',
  fontWeight: '600',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  padding: '14px 40px',
  borderRadius: emailTheme.radius.pill,
  textDecoration: 'none',
  display: 'inline-block'
}

const fallback = {
  fontSize: '12px',
  color: emailTheme.colors.mono.textMuted,
  margin: '16px 0 0',
  wordBreak: 'break-all' as const
}

const fallbackLink = {
  color: emailTheme.colors.mono.textMuted,
  textDecoration: 'underline'
}

const footer = {
  borderTop: `1px solid ${emailTheme.colors.mono.border}`,
  padding: '24px 40px',
  textAlign: 'center' as const
}

const footerText = {
  fontSize: '12px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0'
}

const footerLink = {
  color: emailTheme.colors.mono.textMuted,
  textDecoration: 'underline'
}

export default WelcomeEmail
