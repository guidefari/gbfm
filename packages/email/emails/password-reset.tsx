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
import type * as React from 'react'

interface PasswordResetEmailProps {
  resetUrl: string
  expiresIn?: string
}

export const PasswordResetEmail: React.FC<
  Readonly<PasswordResetEmailProps>
> = ({ resetUrl, expiresIn = '1 hour' }) => {
  return (
    <Html>
      <Head />
      <Preview>Reset your goosebumps.fm password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>goosebumps.fm</Heading>
            <Text style={subtitle}>Password Reset</Text>
          </Section>

          <Section style={content}>
            <Heading style={h2}>Reset Your Password</Heading>
            <Text style={text}>
              We received a request to reset your password for your
              goosebumps.fm account.
            </Text>

            <Text style={text}>
              Click the button below to create a new password:
            </Text>

            <Button style={button} href={resetUrl}>
              Reset Password
            </Button>

            <Text style={text}>
              This link will expire in {expiresIn}. If you didn't request this
              password reset, you can safely ignore this email.
            </Text>

            <Text style={text}>
              For security reasons, this link can only be used once. If you need
              to reset your password again, please request a new reset link.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              If you're having trouble with the button above, copy and paste
              this URL into your browser:
            </Text>
            <Text style={urlText}>
              <Link href={resetUrl} style={link}>
                {resetUrl}
              </Link>
            </Text>
            <Text style={footerText}>
              Best regards,
              <br />
              The goosebumps.fm Team
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
  backgroundColor: '#f6f9fc',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px'
}

const header = {
  textAlign: 'center' as const,
  padding: '48px 0',
  backgroundColor: '#1a1a1a',
  color: '#ffffff'
}

const h1 = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0 0 8px',
  textAlign: 'center' as const
}

const subtitle = {
  color: '#cccccc',
  fontSize: '16px',
  margin: '0',
  textAlign: 'center' as const
}

const content = {
  padding: '48px 24px'
}

const h2 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 16px'
}

const text = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px'
}

const button = {
  backgroundColor: '#1a1a1a',
  borderRadius: '6px',
  color: '#ffffff',
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
  borderTop: '1px solid #e6e6e6',
  padding: '32px 24px',
  textAlign: 'center' as const
}

const footerText = {
  color: '#666666',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 8px'
}

const urlText = {
  color: '#666666',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '16px 0',
  wordBreak: 'break-all' as const
}

const link = {
  color: '#1a1a1a',
  textDecoration: 'underline'
}

export default PasswordResetEmail
