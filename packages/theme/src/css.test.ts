import { describe, it, expect } from 'vitest'
import { toKebab, toVars, semanticToVars, generateCSS } from './css'
import { dark, light, studio } from './tokens/shadcn'
import { brand } from './tokens/brand'

describe('toKebab', () => {
  it('converts camelCase to kebab-case', () => {
    expect(toKebab('backgroundColor')).toBe('background-color')
    expect(toKebab('cardForeground')).toBe('card-foreground')
    expect(toKebab('highlightForeground')).toBe('highlight-foreground')
    expect(toKebab('mutedForeground')).toBe('muted-foreground')
  })

  it('passes through already-kebab strings unchanged', () => {
    expect(toKebab('pastel-green-1')).toBe('pastel-green-1')
    expect(toKebab('pastel-green-2')).toBe('pastel-green-2')
    expect(toKebab('highlight-rgb')).toBe('highlight-rgb')
  })

  it('passes through single-word lowercase unchanged', () => {
    expect(toKebab('background')).toBe('background')
    expect(toKebab('highlight')).toBe('highlight')
    expect(toKebab('radius')).toBe('radius')
  })

  it('handles consecutive capitals correctly', () => {
    expect(toKebab('primaryForeground')).toBe('primary-foreground')
    expect(toKebab('accentForeground')).toBe('accent-foreground')
  })
})

describe('toVars', () => {
  it('produces CSS custom property declarations', () => {
    const result = toVars({ background: 'red', foreground: 'blue' })
    expect(result).toContain('--background: red;')
    expect(result).toContain('--foreground: blue;')
  })

  it('uses default indent of 4 spaces', () => {
    const result = toVars({ background: 'red' })
    expect(result).toBe('    --background: red;')
  })

  it('respects custom indent', () => {
    const result = toVars({ background: 'red' }, '  ')
    expect(result).toBe('  --background: red;')
  })

  it('converts camelCase keys to kebab-case', () => {
    const result = toVars({ cardForeground: 'white' })
    expect(result).toContain('--card-foreground: white;')
  })

  it('preserves pre-hyphenated keys', () => {
    const result = toVars({ 'pastel-green-1': '#b6fadf' })
    expect(result).toContain('--pastel-green-1: #b6fadf;')
  })

  it('outputs one declaration per key', () => {
    const result = toVars({ a: '1', b: '2', c: '3' })
    const lines = result.split('\n')
    expect(lines).toHaveLength(3)
  })

  it('joins multiple entries with newlines', () => {
    const result = toVars({ background: 'red', foreground: 'blue' })
    expect(result.split('\n')).toHaveLength(2)
  })
})

describe('semanticToVars', () => {
  it('includes all semantic token keys as CSS vars', () => {
    const result = semanticToVars(dark)
    expect(result).toContain('--highlight:')
    expect(result).toContain('--highlight-foreground:')
    expect(result).toContain('--background:')
    expect(result).toContain('--foreground:')
    expect(result).toContain('--card:')
    expect(result).toContain('--card-foreground:')
    expect(result).toContain('--popover:')
    expect(result).toContain('--popover-foreground:')
    expect(result).toContain('--primary:')
    expect(result).toContain('--primary-foreground:')
    expect(result).toContain('--secondary:')
    expect(result).toContain('--secondary-foreground:')
    expect(result).toContain('--muted:')
    expect(result).toContain('--muted-foreground:')
    expect(result).toContain('--accent:')
    expect(result).toContain('--accent-foreground:')
    expect(result).toContain('--destructive:')
    expect(result).toContain('--destructive-foreground:')
    expect(result).toContain('--border:')
    expect(result).toContain('--input:')
    expect(result).toContain('--ring:')
    expect(result).toContain('--radius:')
  })

  it('places --radius last', () => {
    const result = semanticToVars(dark)
    const lines = result.split('\n').filter((l) => l.trim().length > 0)
    expect(lines.at(-1)).toContain('--radius:')
  })

  it('outputs correct values for dark theme', () => {
    const result = semanticToVars(dark)
    expect(result).toContain(`--background: ${dark.background};`)
    expect(result).toContain(`--foreground: ${dark.foreground};`)
    expect(result).toContain(`--primary: ${dark.primary};`)
    expect(result).toContain(`--radius: ${dark.radius};`)
  })

  it('outputs correct values for light theme', () => {
    const result = semanticToVars(light)
    expect(result).toContain(`--background: ${light.background};`)
    expect(result).toContain(`--primary: ${light.primary};`)
    expect(result).toContain(`--radius: ${light.radius};`)
  })

  it('outputs correct values for studio theme', () => {
    const result = semanticToVars(studio)
    expect(result).toContain(`--background: ${studio.background};`)
    expect(result).toContain(`--highlight: ${studio.highlight};`)
    expect(result).toContain(`--radius: ${studio.radius};`)
  })

  it('dark and light produce different background values', () => {
    const darkResult = semanticToVars(dark)
    const lightResult = semanticToVars(light)
    const darkBg = darkResult
      .split('\n')
      .find((l) => l.match(/^\s+--background:/))
    const lightBg = lightResult
      .split('\n')
      .find((l) => l.match(/^\s+--background:/))
    expect(darkBg).not.toBe(lightBg)
  })

  it('respects custom indent', () => {
    const result = semanticToVars(dark, '  ')
    const lines = result.split('\n').filter((l) => l.trim().length > 0)
    for (const line of lines) {
      expect(line.startsWith('  ')).toBe(true)
    }
  })
})

describe('generateCSS', () => {
  it('includes the auto-generated comment header', () => {
    const css = generateCSS()
    expect(css).toContain('AUTO-GENERATED by packages/theme/src/css.ts')
  })

  it('wraps everything in @layer base', () => {
    const css = generateCSS()
    expect(css).toContain('@layer base {')
    expect(css.trimEnd().endsWith('}')).toBe(true)
  })

  it('has :root, .light, [data-theme="light"] selector block', () => {
    const css = generateCSS()
    expect(css).toContain(':root,')
    expect(css).toContain('.light,')
    expect(css).toContain('[data-theme="light"]')
  })

  it('has .dark, [data-theme="dark"] selector block', () => {
    const css = generateCSS()
    expect(css).toContain('.dark,')
    expect(css).toContain('[data-theme="dark"]')
  })

  it('has [data-theme="studio"] selector block', () => {
    const css = generateCSS()
    expect(css).toContain('[data-theme="studio"]')
  })

  it('includes brand tokens in the light/:root block', () => {
    const css = generateCSS()
    expect(css).toContain(`--bg: ${brand.bg};`)
    expect(css).toContain(`--darker-bg: ${brand.darkerBg};`)
    expect(css).toContain(`--pastel-green-1: ${brand['pastel-green-1']};`)
    expect(css).toContain(`--pastel-green-2: ${brand['pastel-green-2']};`)
    expect(css).toContain(`--default-text: ${brand.defaultText};`)
  })

  it('dark block has correct background value', () => {
    const css = generateCSS()
    const darkBlockStart = css.indexOf('[data-theme="dark"]')
    const darkBlockEnd = css.indexOf('}', darkBlockStart)
    const darkBlock = css.slice(darkBlockStart, darkBlockEnd)
    expect(darkBlock).toContain(`--background: ${dark.background};`)
  })

  it('light block has correct background value', () => {
    const css = generateCSS()
    const lightBlockStart = css.indexOf('[data-theme="light"]')
    const lightBlockEnd = css.indexOf('}', lightBlockStart)
    const lightBlock = css.slice(lightBlockStart, lightBlockEnd)
    expect(lightBlock).toContain(`--background: ${light.background};`)
  })

  it('studio block has correct highlight and radius values', () => {
    const css = generateCSS()
    const studioStart = css.indexOf('[data-theme="studio"]')
    const studioEnd = css.indexOf('}', studioStart)
    const studioBlock = css.slice(studioStart, studioEnd)
    expect(studioBlock).toContain(`--highlight: ${studio.highlight};`)
    expect(studioBlock).toContain(`--radius: ${studio.radius};`)
  })

  it('dark and light blocks have different primary values', () => {
    const css = generateCSS()
    expect(css).toContain(`--primary: ${dark.primary};`)
    expect(css).toContain(`--primary: ${light.primary};`)
    expect(dark.primary).not.toBe(light.primary)
  })

  it('no duplicate --highlight declarations within the dark block', () => {
    const css = generateCSS()
    const darkStart = css.indexOf('.dark,')
    const darkEnd = css.indexOf('\n  }', darkStart)
    const darkBlock = css.slice(darkStart, darkEnd)
    const matches = darkBlock.match(/--highlight:/g)
    expect(matches).toHaveLength(1)
  })

  it('studio radius differs from dark and light radius', () => {
    expect(studio.radius).not.toBe(dark.radius)
    expect(studio.radius).not.toBe(light.radius)
  })
})
