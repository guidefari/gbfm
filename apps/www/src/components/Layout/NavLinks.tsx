import { Disc3, Home, Mail, Radio, Rss, Settings, Tag } from 'lucide-react'
import { TfiYoutube } from 'react-icons/tfi'
import { RSS } from '@/components/RSS'

type BaseLink = {
  name: string
  external?: { link: string }
  icon: React.ReactNode
  adminOnly?: boolean
}

type lol =
  | (BaseLink & { slug: string; CustomComponent?: never })
  | (BaseLink & { slug?: never; CustomComponent: React.JSX.Element })

const iconSytles = 'h-5 w-5 transition-all group-hover:scale-110'

// https://www.youtube.com/watch?v=KyYQcms0Shg
export const pagesAndPages: lol[] = [
  {
    name: 'Home',
    slug: '/',
    icon: <Home className={iconSytles} />
  },
  {
    name: 'Mixes',
    slug: '/mixes',
    icon: <Disc3 className={iconSytles} />
  },
  {
    name: 'Radio Shows',
    slug: '/shows',
    icon: <Radio className={iconSytles} />
  },
  {
    name: 'Record Labels',
    slug: '/labels',
    icon: <Tag className={iconSytles} />
  },
  {
    name: 'Subscribe',
    slug: '/subscribe',
    icon: <Mail className={iconSytles} />
  },
  {
    icon: <Rss className={iconSytles} />,
    name: 'Mixes via RSS',
    CustomComponent: <RSS />
  },
  {
    icon: <TfiYoutube className={iconSytles} />,
    name: 'Mixes via Youtube',
    CustomComponent: (
      <a href='https://youtube.com/@goosebumpsfm' className='text-inherit'>
        <TfiYoutube className={iconSytles} />
      </a>
    )
  },
  {
    name: 'Admin',
    slug: '/admin',
    icon: <Settings className={iconSytles} />,
    adminOnly: true
  }
]
