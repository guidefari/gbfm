import { describe, expect, it } from 'vitest'
import { dark, light } from '@gbfm/theme'
import { themeColorsPlugin } from './theme-colors'

describe('themeColorsPlugin', () => {
  const plugin = themeColorsPlugin()
  const transform = plugin.transformIndexHtml as (html: string) => string

  it('has correct plugin name', () => {
    expect(plugin.name).toBe('theme-colors')
  })

  it('has enforce: pre', () => {
    expect(plugin.enforce).toBe('pre')
  })

  it('replaces dark theme placeholder with hex value', () => {
    const html = '<meta content="<!-- theme-color:dark --><!-- /theme-color:dark -->" />'
    const result = transform(html)
    expect(result).toBe(`<meta content="${dark.backgroundHex}" />`)
  })

  it('replaces light theme placeholder with hex value', () => {
    const html = '<meta content="<!-- theme-color:light --><!-- /theme-color:light -->" />'
    const result = transform(html)
    expect(result).toBe(`<meta content="${light.backgroundHex}" />`)
  })

  it('replaces multiple dark placeholders', () => {
    const html = `
      <meta content="<!-- theme-color:dark --><!-- /theme-color:dark -->" />
      <style>body { background: <!-- theme-color:dark --><!-- /theme-color:dark -->; }</style>
    `
    const result = transform(html)
    const matches = result.match(new RegExp(dark.backgroundHex, 'g'))
    expect(matches).toHaveLength(2)
  })

  it('replaces multiple light placeholders', () => {
    const html = `
      <meta content="<!-- theme-color:light --><!-- /theme-color:light -->" />
      <style>body { background: <!-- theme-color:light --><!-- /theme-color:light -->; }</style>
    `
    const result = transform(html)
    const matches = result.match(new RegExp(light.backgroundHex, 'g'))
    expect(matches).toHaveLength(2)
  })

  it('replaces both dark and light placeholders in same document', () => {
    const html = `
      <meta content="<!-- theme-color:dark --><!-- /theme-color:dark -->" media="(prefers-color-scheme: dark)" />
      <meta content="<!-- theme-color:light --><!-- /theme-color:light -->" media="(prefers-color-scheme: light)" />
    `
    const result = transform(html)
    expect(result).toContain(dark.backgroundHex)
    expect(result).toContain(light.backgroundHex)
  })

  it('leaves HTML without placeholders unchanged', () => {
    const html = '<html><body><div id="root"></div></body></html>'
    const result = transform(html)
    expect(result).toBe(html)
  })

  it('handles full index.html structure', () => {
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta name="theme-color" content="<!-- theme-color:dark --><!-- /theme-color:dark -->" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="<!-- theme-color:light --><!-- /theme-color:light -->" media="(prefers-color-scheme: light)" />
    <style>
      html, body { background-color: <!-- theme-color:dark --><!-- /theme-color:dark -->; }
      @media (prefers-color-scheme: light) {
        html, body { background-color: <!-- theme-color:light --><!-- /theme-color:light -->; }
      }
    </style>
  </head>
  <body><div id="root"></div></body>
</html>`
    const result = transform(html)
    expect(result).toContain(`content="${dark.backgroundHex}"`)
    expect(result).toContain(`content="${light.backgroundHex}"`)
    expect(result).toContain(`background-color: ${dark.backgroundHex};`)
    expect(result).toContain(`background-color: ${light.backgroundHex};`)
    expect(result).not.toContain('<!-- theme-color:')
  })

  it('dark and light hex values are different', () => {
    expect(dark.backgroundHex).not.toBe(light.backgroundHex)
  })

  it('hex values are valid 6-digit hex colors', () => {
    const hexPattern = /^#[0-9a-f]{6}$/i
    expect(dark.backgroundHex).toMatch(hexPattern)
    expect(light.backgroundHex).toMatch(hexPattern)
  })
})
