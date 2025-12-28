import {
  FileTextIcon,
  HomeIcon,
  Pencil2Icon
  // TwitterLogoIcon
} from '@radix-ui/react-icons'
import { BiSolidCameraHome } from 'react-icons/bi'
import { IoIosMailOpen } from 'react-icons/io'
import { PiVinylRecordLight } from 'react-icons/pi'
// import { SiWritedotas } from 'react-icons/si'
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
    icon: <HomeIcon className={iconSytles} />
  },
  {
    name: 'Mixes',
    slug: '/mixes',
    icon: <PiVinylRecordLight className={iconSytles} />
  },
  // {
  //   name: 'Words',
  //   slug: '/words',
  //   icon: <SiWritedotas className={iconSytles} />
  // },
  // {
  //   name: 'Not Tweets👀',
  //   slug: '/micro',
  //   icon: (
  //     <div className='flex items-center gap-1 -ml-4 text-sm sm:ml-0'>
  //       !<TwitterLogoIcon className={iconSytles} />
  //     </div>
  //   )
  // },
  {
    name: 'Record Labels',
    slug: '/labels',
    icon: <BiSolidCameraHome className={iconSytles} />
  },

  {
    name: 'Subscribe',
    slug: '/subscribe',
    icon: <IoIosMailOpen className={iconSytles} />
  },
  // {
  // 	icon: <GiPerspectiveDiceSixFacesRandom className={iconSytles} />,
  // 	name: "RSP",
  // 	slug: "/rsp",
  // },
  {
    icon: <FileTextIcon className={iconSytles} />,
    name: 'Mixes via RSS',
    CustomComponent: <RSS />
  },
  {
    icon: <FileTextIcon className={iconSytles} />,
    name: 'Mixes via Youtube',
    CustomComponent: (
      <a href='https://youtube.com/@goosebumpsfm' className='text-inherit'>
        <TfiYoutube />
      </a>
    )
  },
  // {
  //   icon: <Pencil2Icon className={iconSytles} />,
  //   name: 'New Post',
  //   slug: '/post'
  // }
  {
    name: 'Admin',
    slug: '/admin',
    icon: <Pencil2Icon className={iconSytles} />,
    adminOnly: true
  }
]
