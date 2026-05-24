import { Section, Text } from '@react-email/components'
import { emailTheme } from './theme'

interface EmailHeaderProps {
  tagline?: string
}

export function EmailHeader({ tagline = 'curated mixes' }: EmailHeaderProps) {
  return (
    <Section style={header}>
      <Text style={logoText}>
        GOOSEBUMPS<span style={logoFm}>.FM</span>
      </Text>
      <Text style={taglineStyle}>{tagline.toUpperCase()}</Text>
    </Section>
  )
}

const header = {
  padding: '40px 20px 30px',
  textAlign: 'center' as const,
  borderBottom: `1px solid ${emailTheme.colors.mono.border}`
}

const logoFm = {
  color: `rgb(155, 253, 158)`
}

const logoText = {
  fontSize: '20px',
  fontWeight: '700',
  letterSpacing: '4px',
  color: emailTheme.colors.mono.white,
  margin: '0 0 4px',
  textTransform: 'uppercase' as const
}

const taglineStyle = {
  fontSize: '11px',
  letterSpacing: '2px',
  color: emailTheme.colors.mono.textMuted,
  margin: '0',
  textTransform: 'uppercase' as const
}
