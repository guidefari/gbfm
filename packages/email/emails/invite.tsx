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

interface InviteEmailProps {
  name: string
  inviteUrl: string
  role?: string
  expiresIn?: string
}

export const InviteEmail: React.FC<Readonly<InviteEmailProps>> = ({
  name,
  inviteUrl,
  role = 'user',
  expiresIn = '7 days'
}) => {
  return (
    <Html>
      <EmailHead />
      <Preview>You've been invited to goosebumps.fm</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader tagline="you're invited" />

          <Section style={hero}>
            <Text style={label}>INVITATION</Text>
            <Text style={headline}>Hey {name}.</Text>
            <Text style={subtext}>
              You've been invited to join goosebumps.fm as a{' '}
              <strong style={{ color: emailTheme.colors.mono.white }}>{role}</strong>. This link
              expires in {expiresIn}.
            </Text>
            <Button style={ctaButton} href={inviteUrl}>
              Set your password
            </Button>
            <Text style={fallback}>
              Button not working?{' '}
              <Link href={inviteUrl} style={fallbackLink}>
                Copy this link
              </Link>
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>If you didn't expect this invitation, ignore this email.</Text>
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
  margin: '0 0 4px'
}

const footerLink = {
  color: emailTheme.colors.mono.textMuted,
  textDecoration: 'underline'
}

export default InviteEmail
