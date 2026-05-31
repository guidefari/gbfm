import {
  Disc3,
  Home,
  Mail,
  MessageSquare,
  Newspaper,
  Radio,
  Rss,
  Settings,
  Tag
} from 'lucide-react'
import { TfiYoutube } from 'react-icons/tfi'
import { RSS } from '@/components/RSS'

export type NavSurface = 'overlay'

export type NavTier = 'primary' | 'secondary' | 'utility'

type BaseNavItem = {
  id: string
  name: string
  icon: React.ReactNode
  tier: NavTier
  surfaces: NavSurface[]
  adminOnly?: boolean
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
    surfaces: ['overlay']
  },
  {
    id: 'editorial',
    name: 'Editorial',
    slug: '/editorial',
    icon: <Newspaper className={iconSytles} />,
    tier: 'primary',
    surfaces: ['overlay']
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
    id: 'mixes',
    name: 'Mixes',
    slug: '/mixes',
    icon: <Disc3 className={iconSytles} />,
    tier: 'secondary',
    surfaces: ['overlay']
  },
  {
    id: 'tweets',
    name: 'Tweets',
    slug: '/tweet',
    icon: <MessageSquare className={iconSytles} />,
    tier: 'secondary',
    surfaces: ['overlay']
  },
  {
    id: 'labels',
    name: 'Record Labels',
    slug: '/labels',
    icon: <Tag className={iconSytles} />,
    tier: 'secondary',
    surfaces: ['overlay']
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
    name: 'Mixes via Youtube',
    icon: <TfiYoutube className={iconSytles} />,
    tier: 'utility',
    surfaces: ['overlay'],
    external: 'https://youtube.com/@goosebumpsfm'
  },
  {
    id: 'admin',
    name: 'Admin',
    slug: '/admin',
    icon: <Settings className={iconSytles} />,
    tier: 'secondary',
    surfaces: ['overlay'],
    adminOnly: true
  }
]

export const navItemsForSurface = (surface: NavSurface) =>
  navConfig.filter((item) => item.surfaces.includes(surface))
