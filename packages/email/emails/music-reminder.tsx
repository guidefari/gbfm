import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text
} from '@react-email/components'
import type * as React from 'react'
import { EmailHead } from './email-head'
import { emailTheme } from './theme'

interface MusicReminderEmailProps {
  username: string
  musicTitle: string
  artistName: string
  musicUrl: string
  reminderDate: string
  notes?: string
  albumCoverUrl?: string
}

export const MusicReminderEmail: React.FC<Readonly<MusicReminderEmailProps>> = ({
  username = 'Music Lover',
  musicTitle = 'Beautiful Song',
  artistName = 'Amazing Artist',
  musicUrl = 'https://spotify.com/track/example',
  reminderDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }),
  notes,
  albumCoverUrl
}) => {
  return (
    <Html>
      <EmailHead />
      <Preview>
        Time to listen: {musicTitle} by {artistName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>GOOSEBUMPS</Text>
            <Text style={tagline}>music reminders</Text>
          </Section>

          {/* Hero Section */}
          <Section style={hero}>
            {albumCoverUrl && (
              <Section style={albumCoverWrapper}>
                <Img
                  src={albumCoverUrl}
                  alt={`${musicTitle} cover`}
                  width='300'
                  height='300'
                  style={albumCover}
                />
              </Section>
            )}
            <Text style={reminderLabel}>MUSIC REMINDER</Text>
            <Heading style={musicTitleStyles}>{musicTitle}</Heading>
            <Text style={artistText}>{artistName}</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Text style={greeting}>Hey {username},</Text>
            <Text style={bodyText}>
              It's time! You wanted to be reminded about this track today. Press play and rediscover
              the magic.
            </Text>

            {notes && <Text style={notesText}>Your note: "{notes}"</Text>}

            <Button style={ctaButton} href={musicUrl}>
              Listen Now
            </Button>

            <Text style={dateInfo}>Reminded on {reminderDate}</Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              <Link href='https://goosebumps.fm' style={footerLink}>
                goosebumps.fm
              </Link>
              {' · '}
              <Link href='https://goosebumps.fm/reminders' style={footerLink}>
                Manage Reminders
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
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

const header = {
  padding: '40px 20px 30px',
  textAlign: 'center' as const,
  borderBottom: `1px solid ${emailTheme.colors.mono.border}`
}

const logoText = {
  fontSize: '20px',
  fontWeight: '700',
  letterSpacing: '4px',
  color: emailTheme.colors.mono.white,
  margin: '0 0 4px',
  textTransform: 'uppercase' as const
}

const tagline = {
  fontSize: '11px',
  letterSpacing: '2px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0',
  textTransform: 'uppercase' as const
}

const hero = {
  padding: '60px 20px',
  textAlign: 'center' as const
}

const reminderLabel = {
  fontSize: '11px',
  letterSpacing: '3px',
  color: emailTheme.colors.mono.textSecondary,
  margin: '0 0 20px',
  textTransform: 'uppercase' as const
}

const content = {
  padding: '40px 40px 60px',
  textAlign: 'center' as const
}

const greeting = {
  fontSize: '16px',
  color: emailTheme.colors.mono.white,
  margin: '0 0 16px',
  fontWeight: '500'
}

const bodyText = {
  fontSize: '16px',
  lineHeight: '24px',
  color: emailTheme.colors.mono.textSecondary,
  margin: '0 0 32px'
}

const notesText = {
  fontSize: '16px',
  lineHeight: '24px',
  color: emailTheme.colors.mono.textTertiary,
  margin: '0 0 32px',
  fontStyle: 'italic'
}

const ctaButton = {
  backgroundColor: emailTheme.colors.mono.textPrimary,
  color: emailTheme.colors.mono.black,
  fontSize: '14px',
  fontWeight: '600',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  padding: '14px 40px',
  borderRadius: emailTheme.radius.pill,
  textDecoration: 'none',
  display: 'inline-block',
  margin: '0 0 24px'
}

const dateInfo = {
  fontSize: '13px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0'
}

const musicTitleStyles = {
  color: emailTheme.colors.mono.textPrimary,
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '24px 0 8px',
  textAlign: 'center' as const
}

const artistText = {
  color: emailTheme.colors.mono.textTertiary,
  fontSize: '18px',
  margin: '0 0 8px',
  textAlign: 'center' as const
}

const albumCoverWrapper = {
  marginBottom: '32px',
  textAlign: 'center' as const
}

const albumCover = {
  margin: '0 auto',
  borderRadius: emailTheme.radius.lg,
  border: `1px solid ${emailTheme.colors.mono.border}`,
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
}

const footer = {
  borderTop: `1px solid ${emailTheme.colors.mono.border}`,
  padding: '32px 24px',
  textAlign: 'center' as const
}

const footerText = {
  color: emailTheme.colors.mono.textMuted,
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 8px'
}

const footerLink = {
  color: emailTheme.colors.mono.textPrimary,
  textDecoration: 'none'
}

export default MusicReminderEmail
