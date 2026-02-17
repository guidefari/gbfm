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

interface BackupNotificationProps {
  status: 'success' | 'failure'
  timestamp?: string
  database?: string
  host?: string
  filename?: string
  fileSize?: string
  errorMessage?: string
  stackTrace?: string
  logContent?: string
  stage?: string
}

export function BackupNotification({
  status,
  timestamp,
  database,
  host,
  filename,
  fileSize,
  errorMessage,
  stackTrace,
  logContent,
  stage = 'dev'
}: BackupNotificationProps) {
  const subject =
    status === 'success'
      ? `Database Backup Successful - ${stage.toUpperCase()}`
      : `Database Backup Failed - ${stage.toUpperCase()}`

  return (
    <Html>
      <EmailHead />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={getContainerStyle(status)}>
          <Section style={getHeaderStyle(status)}>
            <Heading style={h1}>
              {status === 'success' ? 'Backup Successful' : 'Backup Failed'}
            </Heading>
            <Text style={subtitle}>Database Backup Task</Text>
          </Section>

          <Section style={content}>
            <Heading style={h2}>
              {status === 'success' ? 'Great news!' : 'Something went wrong!'}
            </Heading>

            <Text style={text}>
              {status === 'success'
                ? `The database backup completed successfully on ${timestamp || 'unknown time'}.`
                : `The database backup failed on ${timestamp || 'unknown time'}.`}
            </Text>

            {status === 'success' ? (
              <>
                <Text style={text}>
                  <strong>Backup Details:</strong>
                </Text>
                <Text style={getCodeStyle(status)}>
                  Database: {database || 'Unknown'}
                </Text>
                <Text style={getCodeStyle(status)}>
                  Host: {host || 'Unknown'}
                </Text>
                <Text style={getCodeStyle(status)}>
                  Filename: {filename || 'Unknown'}
                </Text>
                <Text style={getCodeStyle(status)}>
                  Size: {fileSize || 'Unknown'}
                </Text>
                <Text style={getCodeStyle(status)}>Stage: {stage}</Text>
              </>
            ) : (
              <>
                <Text style={text}>
                  <strong>Error Details:</strong>
                </Text>
                <Text style={getCodeStyle(status)}>
                  Error: {errorMessage || 'Unknown error'}
                </Text>
                <Text style={getCodeStyle(status)}>
                  Database: {database || 'Unknown'}
                </Text>
                <Text style={getCodeStyle(status)}>
                  Host: {host || 'Unknown'}
                </Text>
                <Text style={getCodeStyle(status)}>Stage: {stage}</Text>
              </>
            )}

            {stackTrace && (
              <>
                <Text style={text}>
                  <strong>Stack Trace:</strong>
                </Text>
                <Text style={getCodeStyle(status)}>{stackTrace}</Text>
              </>
            )}

            <Button style={button} href='https://goosebumps.fm'>
              Visit goosebumps.fm
            </Button>

            <Text style={text}>
              <strong>Environment Details:</strong>
            </Text>
            <Text style={getCodeStyle(status)}>
              Sent at: {new Date().toISOString()}
            </Text>
            <Text style={getCodeStyle(status)}>Stage: {stage}</Text>
            {logContent && (
              <Text style={getCodeStyle(status)}>Log file attached</Text>
            )}
          </Section>

          <Section style={getFooterStyle(status)}>
            <Text style={footerText}>
              This is an automated notification from the goosebumps.fm database
              backup system.
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

const getContainerStyle = (status: 'success' | 'failure') => ({
  backgroundColor:
    status === 'success'
      ? emailTheme.colors.brand.container
      : emailTheme.colors.status.failureContainer,
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px'
})

const getHeaderStyle = (status: 'success' | 'failure') => ({
  textAlign: 'center' as const,
  padding: '48px 0',
  backgroundColor:
    status === 'success'
      ? emailTheme.colors.brand.header
      : emailTheme.colors.status.failureSurface,
  color: emailTheme.colors.brand.white
})

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

const getCodeStyle = (status: 'success' | 'failure') => ({
  backgroundColor:
    status === 'success'
      ? emailTheme.colors.brand.header
      : emailTheme.colors.status.failureSurface,
  padding: '12px',
  borderRadius: emailTheme.radius.sm,
  fontFamily: emailTheme.typography.mono,
  fontSize: '14px',
  color: emailTheme.colors.brand.textTertiary,
  margin: '0 0 16px',
  whiteSpace: 'pre-wrap' as const
})

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

const getFooterStyle = (status: 'success' | 'failure') => ({
  borderTop: `1px solid ${
    status === 'success'
      ? emailTheme.colors.brand.header
      : emailTheme.colors.status.failureSurface
  }`,
  padding: '32px 24px',
  textAlign: 'center' as const
})

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

export default BackupNotification
