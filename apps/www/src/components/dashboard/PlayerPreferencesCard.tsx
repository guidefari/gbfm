import { Check } from 'lucide-react'
import { useUIStore } from '@/store/ui'

export function PlayerPreferencesCard() {
  const { preferredPlayerType, setPreferredPlayerType } = useUIStore()

  return (
    <div className='space-y-8'>
      <div className='space-y-1'>
        <h3 className='text-sm font-bold uppercase tracking-widest text-muted-foreground'>
          Player Preferences
        </h3>
        <p className='text-xs text-muted-foreground font-medium uppercase tracking-wider'>
          Choose how the audio player appears across the app
        </p>
      </div>

      <div className='flex flex-col md:flex-row gap-6'>
        <PlayerOption
          active={preferredPlayerType === 'full'}
          onClick={() => setPreferredPlayerType('full')}
          title='Full Player'
          description='Bottom bar with all controls'
        />
        <PlayerOption
          active={preferredPlayerType === 'compact'}
          onClick={() => setPreferredPlayerType('compact')}
          title='Compact Player'
          description='Floating mini player'
        />
      </div>
    </div>
  )
}

function PlayerOption({
  active,
  onClick,
  title,
  description
}: {
  active: boolean
  onClick: () => void
  title: string
  description: string
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`
        flex-1 flex flex-col gap-2 p-6 rounded-none border-2 transition-all duration-300 text-left relative
        ${
          active
            ? 'border-primary bg-muted text-foreground'
            : 'border-border text-muted-foreground hover:border-primary/50'
        }
      `}>
      {active && (
        <div className='absolute top-4 right-4'>
          <Check className='w-4 h-4 text-primary' />
        </div>
      )}
      <div className='text-sm font-bold uppercase tracking-widest'>{title}</div>
      <div className='text-xs font-medium uppercase tracking-wider opacity-70 leading-relaxed'>
        {description}
      </div>
    </button>
  )
}
