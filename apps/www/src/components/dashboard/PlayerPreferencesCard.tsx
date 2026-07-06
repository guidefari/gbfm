import { useUIStore } from '@/store/ui'

export function PlayerPreferencesCard() {
  const { showBottomPlayer, setShowBottomPlayer } = useUIStore()

  return (
    <div className='space-y-8'>
      <div className='space-y-1'>
        <h3 className='text-sm font-bold tracking-widest text-muted-foreground'>
          Player Preferences
        </h3>
        <p className='text-xs text-muted-foreground font-medium tracking-wider'>
          Choose how the audio player appears across the app
        </p>
      </div>

      <button
        type='button'
        onClick={() => setShowBottomPlayer(!showBottomPlayer)}
        aria-pressed={showBottomPlayer}
        className='flex items-center justify-between w-full max-w-md gap-6 p-6 text-left transition-all border-2 rounded-none border-border hover:border-primary/50'>
        <div className='space-y-2'>
          <div className='text-sm font-bold tracking-widest text-foreground'>Bottom Player</div>
          <div className='text-xs font-medium tracking-wider text-muted-foreground leading-relaxed'>
            Full-width bar with all controls on desktop. When off, use the menu player.
          </div>
        </div>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-sm transition-colors ${
            showBottomPlayer ? 'bg-primary' : 'bg-muted'
          }`}>
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-sm bg-background transition-transform ${
              showBottomPlayer ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>
    </div>
  )
}
