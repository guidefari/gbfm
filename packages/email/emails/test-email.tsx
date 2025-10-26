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
  backgroundColor: '#111827',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
}

const container = {
  backgroundColor: '#1a5368',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px'
}

const header = {
  textAlign: 'center' as const,
  padding: '48px 0',
  backgroundColor: '#4e8c71',
  color: '#ffffff'
}

const h1 = {
  color: '#9bfd9e',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0 0 8px',
  textAlign: 'center' as const
}

const subtitle = {
  color: '#84c9dd',
  fontSize: '16px',
  margin: '0',
  textAlign: 'center' as const
}

const content = {
  padding: '48px 24px'
}

const h2 = {
  color: '#9bfd9e',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 16px'
}

const text = {
  color: '#84c9dd',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px'
}

const code = {
  backgroundColor: '#4e8c71',
  padding: '12px',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#b6fadf',
  margin: '0 0 16px'
}

const button = {
  backgroundColor: '#9bfd9e',
  borderRadius: '6px',
  color: '#111827',
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
  borderTop: '1px solid #4e8c71',
  padding: '32px 24px',
  textAlign: 'center' as const
}

const footerText = {
  color: '#84c9dd',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px'
}

const link = {
  color: '#9bfd9e',
  textDecoration: 'underline'
}

export default TestEmail
