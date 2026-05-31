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

interface NewsletterUnsubscribeLinkProps {
  unsubscribeUrl?: string | undefined
}

export function NewsletterUnsubscribeLink({
  unsubscribeUrl = 'https://goosebumps.fm/unsubscribe'
}: NewsletterUnsubscribeLinkProps) {
  return (
    <Html>
      <EmailHead />
      <Preview>Your unsubscribe link for goosebumps.fm</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader tagline='newsletter' />

          <Section style={body}>
            <Text style={text}>
              You requested an unsubscribe link. Click the button below to be removed from the
              goosebumps.fm mailing list.
            </Text>
            <Button style={ctaButton} href={unsubscribeUrl}>
              Unsubscribe
            </Button>
            <Text style={small}>
              Or copy this link:{' '}
              <Link href={unsubscribeUrl} style={linkStyle}>
                {unsubscribeUrl}
              </Link>
            </Text>
            <Text style={small}>If you did not request this, you can ignore this email.</Text>
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

const body = {
  padding: '48px 40px 32px'
}

const text = {
  fontSize: '16px',
  lineHeight: '26px',
  color: emailTheme.colors.mono.textSecondary,
  margin: '0 0 24px'
}

const small = {
  fontSize: '13px',
  lineHeight: '20px',
  color: emailTheme.colors.mono.textMuted,
  margin: '16px 0 0'
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

const linkStyle = {
  color: emailTheme.colors.mono.textMuted,
  wordBreak: 'break-all' as const
}

export default NewsletterUnsubscribeLink
