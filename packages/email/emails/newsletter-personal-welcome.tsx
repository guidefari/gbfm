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

interface NewsletterPersonalWelcomeProps {
  name?: string | undefined
  unsubscribeUrl?: string | undefined
}

export function NewsletterPersonalWelcome({
  name,
  unsubscribeUrl = 'https://goosebumps.fm/unsubscribe'
}: NewsletterPersonalWelcomeProps) {
  const greeting = name ? `Hey ${name},` : 'Hey,'

  return (
    <Html>
      <EmailHead />
      <Preview>Welcome to goosebumps.fm, glad you found the place.</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader tagline='a word from guide' />

          <Section style={body}>
            <Text style={text}>{greeting}</Text>
            <Text style={text}>
              I noticed you subscribed a little while back and wanted to reach out personally to say
              welcome. Genuinely glad you&apos;re here! I&apos;d love to know how you found the
              site, if you remember.
            </Text>

            <Text style={text}>
              Hit reply any time. Feedback, feature requests, something you&apos;ve been listening
              to, anything really.
            </Text>
            <Text style={text}>Hope the music finds you well.</Text>
            <Text style={signature}>Guide</Text>

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

const body = {
  padding: '48px 40px 32px'
}

const text = {
  fontSize: '16px',
  lineHeight: '26px',
  color: emailTheme.colors.mono.textSecondary,
  margin: '0 0 20px'
}

const signature = {
  fontSize: '16px',
  lineHeight: '26px',
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

export default NewsletterPersonalWelcome
