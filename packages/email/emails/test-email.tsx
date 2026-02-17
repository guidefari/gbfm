import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text
} from '@react-email/components'
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
      <Head />
      <Preview>Test Email - {name}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>🧪 Test Email</Heading>
            <Text style={subtitle}>Development & Testing</Text>
          </Section>

          <Section style={content}>
            <Heading style={h2}>Hello, {name}! 👋</Heading>
            <Text style={text}>{message}</Text>

            <Text style={text}>
              This email was sent from your React Email development environment.
              Use this template to test your email delivery system.
            </Text>

            <Button style={button} href='https://goosebumps.fm'>
              Visit goosebumps.fm
            </Button>

            <Text style={text}>
              <strong>Environment Details:</strong>
            </Text>
            <Text style={code}>Sent at: {new Date().toISOString()}</Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              This is a test email from the goosebumps.fm development
              environment.
            </Text>
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

const code = {
  backgroundColor: emailTheme.colors.brand.header,
  padding: '12px',
  borderRadius: emailTheme.radius.sm,
  fontFamily: emailTheme.typography.mono,
  fontSize: '14px',
  color: emailTheme.colors.brand.textTertiary,
  margin: '0 0 16px'
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

export default TestEmail
