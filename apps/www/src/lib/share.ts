import { publicUrlObj } from './http'

export type ShareContentType = 'mix' | 'track' | 'show' | 'profile' | 'release' | 'label' | 'post'

export function getShareUrl(type: ShareContentType, slug: string): string {
  return publicUrlObj(`/s/${type}/${slug}`).toString()
}
