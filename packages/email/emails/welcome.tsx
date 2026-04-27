import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text
} from '@react-email/components'
import { EmailHead } from './email-head'
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
          <Section style={header}>
            <Heading style={h1}>goosebumps.fm</Heading>
            <Text style={subtitle}>Your music journey starts here</Text>
          </Section>

          <Section style={content}>
            <Heading style={h2}>Welcome, {username}!</Heading>
            <Text style={text}>
              Thanks for joining the goosebumps.fm community. We're glad you're
              here.
            </Text>
            <Text style={text}>
              One quick step: confirm your email address so you can save
              favorites, follow people, and pick up where you left off.
            </Text>

            <Button style={button} href={verificationUrl}>
              Verify your email
            </Button>

            <Text style={mutedText}>
              If the button doesn't work, copy this link into your browser:
              <br />
              <Link href={verificationUrl} style={link}>
                {verificationUrl}
              </Link>
            </Text>

            <Text style={text}>
              If you have any questions or need help getting started, reach out
              to our support team.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>Best regards, The goosebumps.fm Team</Text>
            <Text style={footerText}>
              <Link href='https://goosebumps.fm' style={link}>
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
  backgroundColor: emailTheme.colors.brand.page,
  fontFamily: emailTheme.typography.sans
}

const container = {
  backgroundColor: emailTheme.colors.brand.container,
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px'
}

const header = {
  textAlign: 'center' as const,
  padding: '48px 0',
  backgroundColor: emailTheme.colors.brand.header,
  color: emailTheme.colors.brand.white
}

const h1 = {
  color: emailTheme.colors.brand.textPrimary,
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0 0 8px',
  textAlign: 'center' as const
}

const subtitle = {
  color: emailTheme.colors.brand.textSecondary,
  fontSize: '16px',
  margin: '0',
  textAlign: 'center' as const
}

const content = {
  padding: '48px 24px'
}

const h2 = {
  color: emailTheme.colors.brand.textPrimary,
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 16px'
}

const text = {
  color: emailTheme.colors.brand.textSecondary,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px'
}

const mutedText = {
  color: emailTheme.colors.brand.textSecondary,
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 16px',
  wordBreak: 'break-all' as const
}

const button = {
  backgroundColor: emailTheme.colors.brand.textPrimary,
  borderRadius: emailTheme.radius.md,
  color: emailTheme.colors.brand.textInverse,
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  width: '200px',
  padding: '12px',
  margin: '32px auto'
}

const footer = {
  borderTop: `1px solid ${emailTheme.colors.brand.header}`,
  padding: '32px 24px',
  textAlign: 'center' as const
}

const footerText = {
  color: emailTheme.colors.brand.textSecondary,
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px'
}

const link = {
  color: emailTheme.colors.brand.textPrimary,
  textDecoration: 'underline'
}

export default WelcomeEmail
