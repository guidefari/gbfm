/**
 * Vite plugin that injects theme colors from @gbfm/theme tokens into index.html.
 *
 * This prevents flash of wrong colors before React loads by:
 * - Setting correct background-color on html/body
 * - Setting theme-color meta tags for iOS Safari browser chrome
 *
 * Usage in index.html:
 *   <!-- theme-color:dark --><!-- /theme-color:dark -->
 *   <!-- theme-color:light --><!-- /theme-color:light -->
 *
 * These placeholders get replaced with hex values from packages/theme/src/tokens/shadcn.ts
 */
import type { Plugin } from 'vite'
import { dark, light } from '../../../packages/theme/src/tokens/shadcn.ts'

export function themeColorsPlugin(): Plugin {
  return {
    name: 'theme-colors',
    enforce: 'pre',
    transformIndexHtml(html) {
      return html
        .replace(/<!-- theme-color:dark -->([^<]*)<!-- \/theme-color:dark -->/g, dark.backgroundHex)
        .replace(
          /<!-- theme-color:light -->([^<]*)<!-- \/theme-color:light -->/g,
          light.backgroundHex
        )
    }
  }
}
