import { Heart, Music, Radio, Search, Settings, User } from 'lucide-react'
import { IconGrid } from './icon-grid'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/IconGrid'
}

const tiles = [
  {
    id: 'mixes',
    label: 'Mixes',
    icon: Music,
    onSelect: () => {},
    shortcut: 'M'
  },
  {
    id: 'radio',
    label: 'Radio',
    icon: Radio,
    onSelect: () => {},
    shortcut: 'R'
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    onSelect: () => {},
    shortcut: 'P'
  },
  {
    id: 'search',
    label: 'Search',
    icon: Search,
    onSelect: () => {},
    shortcut: 'S'
  },
  {
    id: 'favourites',
    label: 'Favourites',
    icon: Heart,
    onSelect: () => {},
    requiresAuth: true
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    onSelect: () => {},
    requiresAuth: true
  }
]

export function IconGridAuthenticated() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Navigation'
        title='IconGrid'
        description='Keyboard-navigable grid of icon tiles. Arrow keys move selection, Enter activates.'
      />
      <div className='space-y-6'>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>Authenticated (all tiles visible)</p>
          <IconGrid tiles={tiles} onTileSelect={(t) => console.log(t.id)} isAuthenticated={true} />
        </div>
        <div>
          <p className='text-xs text-muted-foreground mb-2'>
            Unauthenticated (auth-required tiles hidden)
          </p>
          <IconGrid tiles={tiles} onTileSelect={(t) => console.log(t.id)} isAuthenticated={false} />
        </div>
      </div>
    </div>
  )
}
