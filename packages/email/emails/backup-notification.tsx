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
      ? `✅ Database Backup Successful - ${stage.toUpperCase()}`
      : `❌ Database Backup Failed - ${stage.toUpperCase()}`

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={getContainerStyle(status)}>
          <Section style={getHeaderStyle(status)}>
            <Heading style={h1}>
              {status === 'success'
                ? '✅ Backup Successful'
                : '❌ Backup Failed'}
            </Heading>
            <Text style={subtitle}>Database Backup Task</Text>
          </Section>

          <Section style={content}>
            <Heading style={h2}>
              {status === 'success'
                ? 'Great news! 🎉'
                : 'Something went wrong! ⚠️'}
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
  backgroundColor: '#111827',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
}

const getContainerStyle = (status: 'success' | 'failure') => ({
  backgroundColor: status === 'success' ? '#1a5368' : '#5a1a1a',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px'
})

const getHeaderStyle = (status: 'success' | 'failure') => ({
  textAlign: 'center' as const,
  padding: '48px 0',
  backgroundColor: status === 'success' ? '#4e8c71' : '#8c4e4e',
  color: '#ffffff'
})

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

const getCodeStyle = (status: 'success' | 'failure') => ({
  backgroundColor: status === 'success' ? '#4e8c71' : '#8c4e4e',
  padding: '12px',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#b6fadf',
  margin: '0 0 16px',
  whiteSpace: 'pre-wrap' as const
})

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

const getFooterStyle = (status: 'success' | 'failure') => ({
  borderTop: `1px solid ${status === 'success' ? '#4e8c71' : '#8c4e4e'}`,
  padding: '32px 24px',
  textAlign: 'center' as const
})

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

export default BackupNotification
