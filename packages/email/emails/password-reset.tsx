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
import type * as React from 'react'
import { EmailHead } from './email-head'
import { emailTheme } from './theme'

interface PasswordResetEmailProps {
  resetUrl: string
  expiresIn?: string
}

export const PasswordResetEmail: React.FC<
  Readonly<PasswordResetEmailProps>
> = ({ resetUrl, expiresIn = '1 hour' }) => {
  return (
    <Html>
      <EmailHead />
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

const urlText = {
  color: emailTheme.colors.brand.textSecondary,
  fontSize: '12px',
  lineHeight: '16px',
  margin: '16px 0',
  wordBreak: 'break-all' as const
}

const link = {
  color: emailTheme.colors.brand.textPrimary,
  textDecoration: 'underline'
}

export default PasswordResetEmail
