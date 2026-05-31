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
import type * as React from 'react'
import { EmailHead } from './email-head'
import { EmailHeader } from './email-header'
import { emailTheme } from './theme'

interface PasswordResetEmailProps {
  resetUrl: string
  expiresIn?: string
}

export const PasswordResetEmail: React.FC<Readonly<PasswordResetEmailProps>> = ({
  resetUrl,
  expiresIn = '1 hour'
}) => {
  return (
    <Html>
      <EmailHead />
      <Preview>Reset your goosebumps.fm password</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader tagline='password reset' />

          <Section style={hero}>
            <Text style={label}>ACCOUNT</Text>
            <Text style={headline}>Reset your password.</Text>
            <Text style={subtext}>
              We received a request to reset your password. This link expires in {expiresIn} and can
              only be used once.
            </Text>
            <Button style={ctaButton} href={resetUrl}>
              Reset password
            </Button>
            <Text style={fallback}>
              Button not working?{' '}
              <Link href={resetUrl} style={fallbackLink}>
                Copy this link
              </Link>
            </Text>
            <Text style={warning}>
              If you didn't request this, ignore this email, your password won't change.
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

const warning = {
  fontSize: '13px',
  color: emailTheme.colors.mono.textMuted,
  margin: '24px 0 0',
  fontStyle: 'italic' as const
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

export default PasswordResetEmail
