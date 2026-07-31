import { useNowPlayingTrack } from '@/services/player'
import { NavItemLink, NavSection } from './NavItemLink'
import { NowPlayingMini } from './NowPlayingMini'
import { StationList } from './StationList'
import { useNavSections } from './useNavSections'

export function StationNavPanel({
  activeStationSlug,
  onNavigate
}: {
  activeStationSlug?: string
  onNavigate?: () => void
}) {
  const { browse, create, utility } = useNavSections()
  const currentTrack = useNowPlayingTrack()

  return (
    <div className='flex flex-col gap-6'>
      {currentTrack && (
        <NavSection title='Now playing'>
          <NowPlayingMini onClose={onNavigate} />
        </NavSection>
      )}

      <NavSection title='Stations'>
        <StationList activeSlug={activeStationSlug} onNavigate={onNavigate} />
      </NavSection>

      <NavSection title='Browse'>
        {browse.map((item) => (
          <NavItemLink key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </NavSection>

      {create.length > 0 && (
        <NavSection title='Create'>
          {create.map((item) => (
            <NavItemLink key={item.id} item={item} onNavigate={onNavigate} />
          ))}
        </NavSection>
      )}

      <NavSection title='Follow'>
        {utility.map((item) => (
          <NavItemLink key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </NavSection>
    </div>
  )
}
