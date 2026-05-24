import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Link,
  // Img,
  Preview,
  Section,
  Text
} from '@react-email/components'
import type * as React from 'react'
import { EmailHead } from './email-head'
import { EmailHeader } from './email-header'
import { emailTheme } from './theme'

interface NewMixNotificationProps {
  username: string
  mixTitle: string
  artistName: string
  mixUrl: string
  coverImageUrl?: string
  releaseDate?: string
}

export const NewMixNotification: React.FC<
  Readonly<NewMixNotificationProps>
> = ({
  username = 'abstractrhythmrecords',
  mixTitle = 'gb#63',
  artistName = 'Guide Fari',
  mixUrl = 'https://goosebumps.fm/mixes/gb63',
  releaseDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}) => {
  return (
    <Html>
      <EmailHead />
      <Preview>
        New mix alert: {mixTitle} by {artistName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <EmailHeader tagline='curated mixes' />

          {/* Hero Section */}
          <Section style={hero}>
            <Text style={newMixLabel}>NEW MIX</Text>
            <Heading style={mixTitleStyles}>{mixTitle}</Heading>
            <Text style={artistText}>{artistName}</Text>
          </Section>

          {/* Cover Image */}
          {/* {coverImageUrl && (
              <Section style={imageSection}>
                <Img
                  src={coverImageUrl}
                  alt={mixTitle}
                  style={coverImage}
                  width="560"
                  height="560"
                />
              </Section>
            )} */}

          {/* Content */}
          <Section style={content}>
            <Text style={greeting}>Hey {username},</Text>
            <Text style={bodyText}>
              A new mix just landed on goosebumps.fm. Press play and let the
              music take you somewhere.
            </Text>

            <Button style={ctaButton} href={mixUrl}>
              Listen Now
            </Button>

            <Text style={dateInfo}>Released {releaseDate}</Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              <Link href='https://goosebumps.fm' style={footerLink}>
                goosebumps.fm
              </Link>
              {' · '}
              <Link href='https://goosebumps.fm/settings' style={footerLink}>
                Settings
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

const hero = {
  padding: '60px 20px',
  textAlign: 'center' as const
}

const newMixLabel = {
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
  display: 'inline-block',
  margin: '0 0 24px'
}

const dateInfo = {
  fontSize: '13px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0'
}

const mixTitleStyles = {
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

export default NewMixNotification
