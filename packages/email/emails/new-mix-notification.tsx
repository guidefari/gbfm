import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
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
  username = 'Music Lover',
  mixTitle = 'Summer Vibes 2024',
  artistName = 'DJ Example',
  mixUrl = 'https://goosebumps.fm/mixes/1',
  coverImageUrl,
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
        New mix: {mixTitle} by {artistName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>goosebumps.fm</Heading>
            <Text style={subtitle}>New Mix Alert</Text>
          </Section>

          <Section style={content}>
            <Heading style={h2}>Hey {username}! 🎧</Heading>
            <Text style={text}>
              {artistName} just dropped a fresh mix that we think you'll love!
            </Text>

            {coverImageUrl && (
              <div style={coverImageContainer}>
                <Img
                  src={coverImageUrl}
                  alt={mixTitle}
                  style={coverImage}
                  width='300'
                  height='300'
                />
              </div>
            )}

            <Heading style={mixTitleStyles}>{mixTitle}</Heading>
            <Text style={artistText}>by {artistName}</Text>
            <Text style={dateText}>Released {releaseDate}</Text>

            <Button style={button} href={mixUrl}>
              Listen Now
            </Button>

            <Text style={text}>
              Get ready to vibe and let us know what you think!
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You're receiving this because you follow {artistName} or have
              shown interest in similar mixes.
            </Text>
            <Text style={footerText}>
              <Link
                href='https://goosebumps.fm/settings/notifications'
                style={link}>
                Manage notification preferences
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

const coverImageContainer = {
  textAlign: 'center' as const,
  margin: '32px 0'
}

const coverImage = {
  borderRadius: '8px',
  objectFit: 'cover' as const,
  maxWidth: '100%',
  height: 'auto'
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

const dateText = {
  color: '#84c9dd',
  fontSize: '14px',
  margin: '0 0 24px',
  textAlign: 'center' as const
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

export default NewMixNotification
