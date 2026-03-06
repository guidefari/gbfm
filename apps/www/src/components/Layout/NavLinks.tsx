import { Disc3, Home, Mail, Radio, Rss, Settings, Tag } from 'lucide-react'
import { TfiYoutube } from 'react-icons/tfi'
import { RSS } from '@/components/RSS'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href='https://youtube.com/@goosebumpsfm'
              target='_blank'
              rel='noreferrer'
              className='flex items-center justify-center transition-colors rounded-sm h-9 w-9 text-gb-bg hover:text-white md:h-8 md:w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
              <TfiYoutube className={iconSytles} />
              <span className='sr-only'>Mixes via Youtube</span>
            </a>
          </TooltipTrigger>
          <TooltipContent side='right'>Mixes via Youtube</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  },
  {
    name: 'Admin',
    slug: '/admin',
    icon: <Settings className={iconSytles} />,
    adminOnly: true
  }
]
