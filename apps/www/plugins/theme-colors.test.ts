import { describe, expect, it } from 'vitest'
import { dark, light } from '@gbfm/theme'
import { transformThemeColors } from './theme-colors'

describe('themeColorsPlugin', () => {
  it('injects both theme colors throughout the index document', () => {
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
    const result = transformThemeColors(html)
    expect(result).toContain(`content="${dark.backgroundHex}"`)
    expect(result).toContain(`content="${light.backgroundHex}"`)
    expect(result).toContain(`background-color: ${dark.backgroundHex};`)
    expect(result).toContain(`background-color: ${light.backgroundHex};`)
    expect(result).not.toContain('<!-- theme-color:')
  })

  it('leaves documents without theme placeholders unchanged', () => {
    const html = '<html><body><div id="root"></div></body></html>'
    expect(transformThemeColors(html)).toBe(html)
  })
})
