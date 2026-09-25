import { Disc3, Home, Mail, MessageSquare, Newspaper, Radio, Rss, Tag } from 'lucide-react'
import { RSS } from '@/components/RSS'
import { YoutubeIcon } from '@/components/icons/YoutubeIcon'
import { useTweetTrail } from '@/store/tweetTrail'

export type NavSurface = 'overlay' | 'desktop'

export type NavTier = 'primary' | 'secondary' | 'utility' | 'create'

export type MinRole = 'creator' | 'editor' | 'admin'

type BaseNavItem = {
  id: string
  name: string
  icon: React.ReactNode
  tier: NavTier
  surfaces: NavSurface[]
  description?: string
  adminOnly?: boolean
  authOnly?: boolean
  minRole?: MinRole
}

export type NavItem =
  | (BaseNavItem & { slug: string; external?: never; CustomComponent?: never })
  | (BaseNavItem & {
      slug?: never
      external: string
      CustomComponent?: never
    })
  | (BaseNavItem & {
      slug?: never
      external?: never
      CustomComponent: React.JSX.Element
    })

const iconSytles = 'h-5 w-5 transition-all group-hover:scale-110'

export const navConfig: NavItem[] = [
  {
    id: 'home',
    name: 'Home',
    slug: '/',
    icon: <Home className={iconSytles} />,
    tier: 'primary',
    surfaces: ['overlay']
  },
  {
    id: 'shows',
    name: 'Radio Shows',
    slug: '/shows',
    icon: <Radio className={iconSytles} />,
    tier: 'primary',
    surfaces: ['overlay', 'desktop']
  },
  {
    id: 'editorial',
    name: 'Editorial',
    slug: '/editorial',
    icon: <Newspaper className={iconSytles} />,
    tier: 'primary',
    surfaces: ['overlay', 'desktop']
  },
  {
    id: 'subscribe',
    name: 'Subscribe',
    slug: '/subscribe',
    icon: <Mail className={iconSytles} />,
    tier: 'primary',
    surfaces: ['overlay']
  },
  {
    id: 'tweets',
    name: 'Tweets',
    slug: '/tweet',
    icon: <MessageSquare className={iconSytles} />,
    tier: 'secondary',
    surfaces: ['overlay', 'desktop']
  },
  {
    id: 'labels',
    name: 'Record Labels',
    slug: '/labels',
    icon: <Tag className={iconSytles} />,
    tier: 'secondary',
    surfaces: ['overlay', 'desktop']
  },
  {
    id: 'rss',
    name: 'Mixes via RSS',
    icon: <Rss className={iconSytles} />,
    tier: 'utility',
    surfaces: ['overlay'],
    CustomComponent: <RSS />
  },
  {
    id: 'youtube',
    name: 'Mixes via YouTube',
    icon: <YoutubeIcon className={iconSytles} />,
    tier: 'utility',
    surfaces: ['overlay'],
    external: 'https://youtube.com/@goosebumpsfm'
  },
  {
    id: 'my-content',
    name: 'My content',
    slug: '/dashboard/content',
    icon: <Newspaper className={iconSytles} />,
    tier: 'create',
    surfaces: ['overlay'],
    description: 'Review and publish your mixes, editorials, and tweets.',
    minRole: 'creator'
  },
  {
    id: 'create-mix',
    name: 'New mix',
    slug: '/mix-upload',
    icon: <Disc3 className={iconSytles} />,
    tier: 'create',
    surfaces: ['overlay'],
    description: 'Upload a DJ mix with artwork and tracklist timestamps.',
    minRole: 'editor'
  },
  {
    id: 'create-post',
    name: 'New post',
    slug: '/new',
    icon: <MessageSquare className={iconSytles} />,
    tier: 'create',
    surfaces: ['overlay'],
    description: 'Capture a tweet or write a long-form editorial.',
    minRole: 'editor'
  },
  {
    id: 'create-label',
    name: 'Manage labels',
    slug: '/dashboard/music',
    icon: <Tag className={iconSytles} />,
    tier: 'create',
    surfaces: ['overlay'],
    description: 'Add a record label profile.',
    minRole: 'admin'
  }
]

export const navItemsForSurface = (surface: NavSurface) =>
  navConfig.filter((item) => item.surfaces.includes(surface))

export const navItemsByTier = (tier: NavTier, surface: NavSurface) =>
  navConfig.filter((item) => item.tier === tier && item.surfaces.includes(surface))

/** Skips the landing lookup when this browser already has a current tweet. */
export function useNavItemHref(item: NavItem): string | undefined {
  const trail = useTweetTrail()
  if (!item.slug || item.id !== 'tweets') return item.slug

  const slug = trail.slugs[trail.cursor]
  return slug ? `/tweet/${encodeURIComponent(slug)}` : item.slug
}
