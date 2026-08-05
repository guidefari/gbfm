import { NavItemLink, NavSection } from './NavItemLink'
import { useNavSections } from './useNavSections'

export function StationNavPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { browse, create, utility } = useNavSections()

  return (
    <div className='flex flex-col gap-6'>
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
