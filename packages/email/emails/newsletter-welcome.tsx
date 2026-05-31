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

interface NewsletterWelcomeEmailProps {
  unsubscribeUrl: string
}

export function NewsletterWelcomeEmail({
  unsubscribeUrl = 'https://goosebumps.fm/unsubscribe'
}: NewsletterWelcomeEmailProps) {
  return (
    <Html>
      <EmailHead />
      <Preview>You're on the list. New mixes and goosebumps.fm updates coming your way.</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader tagline='newsletter' />

          <Section style={hero}>
            <Text style={label}>SUBSCRIBED</Text>
            <Text style={headline}>You're on the list.</Text>
            <Text style={subtext}>
              We'll let you know when new mixes drop and share other goosebumps.fm updates. That's
              it, no noise.
            </Text>
            <Button style={ctaButton} href='https://goosebumps.fm'>
              Go to goosebumps.fm
            </Button>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              <Link href='https://goosebumps.fm' style={footerLink}>
                goosebumps.fm
              </Link>
              {' · '}
              <Link href={unsubscribeUrl} style={footerLink}>
                Unsubscribe
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

export default NewsletterWelcomeEmail
