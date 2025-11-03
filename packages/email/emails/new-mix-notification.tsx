import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  // Img,
  Preview,
  Section,
  Text
} from '@react-email/components'
import type * as React from 'react'

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
      <Head />
      <Preview>
        New mix alert: {mixTitle} by {artistName} 🎧
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>GOOSEBUMPS</Text>
            <Text style={tagline}>curated mixes</Text>
          </Section>

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

          {/* Footer */}
          {/* <Section style={footer}>
              <Text style={footerText}>
                <Link href="https://goosebumps.fm" style={footerLink}>
                  goosebumps.fm
                </Link>
                {' · '}
                <Link href="https://goosebumps.fm/settings" style={footerLink}>
                  Settings
                </Link>
                {' · '}
                <Link href="https://goosebumps.fm/unsubscribe" style={footerLink}>
                  Unsubscribe
                </Link>
              </Text>
              <Text style={footerTextSmall}>
                You're receiving this because you follow {artistName} on Goosebumps.
              </Text>
            </Section> */}
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: '#0a0a0a',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
}

const container = {
  backgroundColor: '#0a0a0a',
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px'
}

const header = {
  padding: '40px 20px 30px',
  textAlign: 'center' as const,
  borderBottom: '1px solid #1a1a1a'
}

const logoText = {
  fontSize: '20px',
  fontWeight: '700',
  letterSpacing: '4px',
  color: '#ffffff',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const
}

const tagline = {
  fontSize: '11px',
  letterSpacing: '2px',
  color: '#666666',
  margin: '0',
  textTransform: 'uppercase' as const
}

const hero = {
  padding: '60px 20px',
  textAlign: 'center' as const
}

const newMixLabel = {
  fontSize: '11px',
  letterSpacing: '3px',
  color: '#999999',
  margin: '0 0 20px',
  textTransform: 'uppercase' as const
}

const content = {
  padding: '40px 40px 60px',
  textAlign: 'center' as const
}

const greeting = {
  fontSize: '16px',
  color: '#ffffff',
  margin: '0 0 16px',
  fontWeight: '500'
}

const bodyText = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#999999',
  margin: '0 0 32px'
}

const ctaButton = {
  backgroundColor: '#ffffff',
  color: '#000000',
  fontSize: '14px',
  fontWeight: '600',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
  padding: '14px 40px',
  borderRadius: '30px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '0 0 24px'
}

const dateInfo = {
  fontSize: '13px',
  color: '#666666',
  margin: '0'
}

const mixTitleStyles = {
  color: '#9bfd9e',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '24px 0 8px',
  textAlign: 'center' as const
}

const artistText = {
  color: '#b6fadf',
  fontSize: '18px',
  margin: '0 0 8px',
  textAlign: 'center' as const
}

export default NewMixNotification
