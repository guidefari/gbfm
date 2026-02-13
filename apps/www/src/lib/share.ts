import { VPS_BASE_URL } from './http'

export type ShareContentType =
  | 'mix'
  | 'track'
  | 'show'
  | 'profile'
  | 'release'
  | 'label'
  | 'post'

/**
 * Generates a share URL for the redirect service.
 * The redirect service provides OG meta tags for social media previews.
 */
export function getShareUrl(type: ShareContentType, slug: string): string {
  const baseUrl = VPS_BASE_URL || 'https://vps.goosebumps.fm'
  return `${baseUrl}/s/${type}/${slug}`
}
