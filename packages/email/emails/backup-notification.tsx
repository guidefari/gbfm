import { Body, Container, Html, Link, Preview, Section, Text } from '@react-email/components'
import { EmailHead } from './email-head'
import { EmailHeader } from './email-header'
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
  stage = 'dev'
}: BackupNotificationProps) {
  const isSuccess = status === 'success'
  const preview = isSuccess
    ? `Backup OK — ${stage.toUpperCase()} — ${fileSize ?? 'unknown size'}`
    : `Backup FAILED — ${stage.toUpperCase()} — ${errorMessage ?? 'unknown error'}`

  return (
    <Html>
      <EmailHead />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader tagline={`ops · ${stage}`} />

          {!isSuccess && <Section style={failureBanner} />}

          <Section style={hero}>
            <Text style={label}>{isSuccess ? 'DATABASE BACKUP' : 'DATABASE BACKUP'}</Text>
            <Text style={isSuccess ? headline : headlineError}>
              {isSuccess ? 'Backup complete.' : 'Backup failed.'}
            </Text>
            <Text style={timestamp_style}>{timestamp ?? new Date().toISOString()}</Text>
          </Section>

          <Section style={detailsSection}>
            {isSuccess ? (
              <>
                <Row label='Database' value={database} />
                <Row label='Host' value={host} />
                <Row label='File' value={filename} />
                <Row label='Size' value={fileSize} />
                <Row label='Stage' value={stage} />
              </>
            ) : (
              <>
                <Row label='Error' value={errorMessage} error />
                <Row label='Database' value={database} />
                <Row label='Host' value={host} />
                <Row label='Stage' value={stage} />
              </>
            )}
          </Section>

          {stackTrace && (
            <Section style={stackSection}>
              <Text style={stackLabel}>STACK TRACE</Text>
              <Text style={stackText}>{stackTrace}</Text>
            </Section>
          )}

          <Section style={footer}>
            <Text style={footerText}>
              Automated notification from goosebumps.fm backup system
              {' · '}
              <Link href='https://goosebumps.fm' style={footerLink}>
                goosebumps.fm
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

function Row({
  label,
  value,
  error = false
}: {
  label: string
  value: string | undefined
  error?: boolean
}) {
  return (
    <Section style={row}>
      <Text style={rowLabel}>{label.toUpperCase()}</Text>
      <Text style={error ? rowValueError : rowValue}>{value ?? 'unknown'}</Text>
    </Section>
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

const failureBanner = {
  height: '4px',
  backgroundColor: emailTheme.colors.status.failureSurface
}

const hero = {
  padding: '48px 40px 32px',
  textAlign: 'center' as const
}

const label = {
  fontSize: '11px',
  letterSpacing: '3px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0 0 16px',
  textTransform: 'uppercase' as const
}

const headline = {
  fontSize: '28px',
  fontWeight: '700',
  color: emailTheme.colors.mono.white,
  margin: '0 0 8px'
}

const headlineError = {
  fontSize: '28px',
  fontWeight: '700',
  color: emailTheme.colors.status.failureSurface,
  margin: '0 0 8px'
}

const timestamp_style = {
  fontSize: '13px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0',
  fontFamily: emailTheme.typography.mono
}

const detailsSection = {
  padding: '0 40px 40px'
}

const row = {
  borderTop: `1px solid ${emailTheme.colors.mono.border}`,
  padding: '12px 0',
  display: 'flex' as const
}

const rowLabel = {
  fontSize: '10px',
  letterSpacing: '2px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0 0 4px',
  textTransform: 'uppercase' as const
}

const rowValue = {
  fontSize: '14px',
  color: emailTheme.colors.mono.textSecondary,
  margin: '0',
  fontFamily: emailTheme.typography.mono,
  wordBreak: 'break-all' as const
}

const rowValueError = {
  fontSize: '14px',
  color: emailTheme.colors.status.failureSurface,
  margin: '0',
  fontFamily: emailTheme.typography.mono,
  wordBreak: 'break-all' as const
}

const stackSection = {
  padding: '0 40px 40px'
}

const stackLabel = {
  fontSize: '10px',
  letterSpacing: '2px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0 0 8px',
  textTransform: 'uppercase' as const
}

const stackText = {
  fontSize: '12px',
  color: emailTheme.colors.mono.textMuted,
  fontFamily: emailTheme.typography.mono,
  whiteSpace: 'pre-wrap' as const,
  backgroundColor: '#0d1117',
  padding: '16px',
  borderRadius: emailTheme.radius.sm,
  margin: '0',
  wordBreak: 'break-all' as const
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

export default BackupNotification
