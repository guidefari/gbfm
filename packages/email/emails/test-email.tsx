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

interface TestEmailProps {
  name?: string
  message?: string
}

export function TestEmail({
  name = 'Developer',
  message = 'This is a test email from your React Email development environment!'
}: TestEmailProps) {
  return (
    <Html>
      <EmailHead />
      <Preview>Test Email - {name}</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader tagline='dev · testing' />

          <Section style={hero}>
            <Text style={label}>TEST EMAIL</Text>
            <Text style={headline}>Hello, {name}.</Text>
            <Text style={subtext}>{message}</Text>
            <Button style={ctaButton} href='https://goosebumps.fm'>
              Visit goosebumps.fm
            </Button>
            <Text style={meta}>Sent at: {new Date().toISOString()}</Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              <Link href='https://goosebumps.fm' style={footerLink}>
                goosebumps.fm
              </Link>
            </Text>
            <Text style={footerText}>Development environment</Text>
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

const meta = {
  fontFamily: emailTheme.typography.mono,
  fontSize: '12px',
  color: emailTheme.colors.mono.textMuted,
  margin: '16px 0 0'
}

const footer = {
  borderTop: `1px solid ${emailTheme.colors.mono.border}`,
  padding: '24px 40px',
  textAlign: 'center' as const
}

const footerText = {
  fontSize: '12px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0 0 4px'
}

const footerLink = {
  color: emailTheme.colors.mono.textMuted,
  textDecoration: 'underline'
}

export default TestEmail
