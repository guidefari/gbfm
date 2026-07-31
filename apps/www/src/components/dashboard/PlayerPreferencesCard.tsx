export function PlayerPreferencesCard() {
  return (
    <div className='space-y-2'>
      <h3 className='text-sm font-bold tracking-widest text-muted-foreground'>Player</h3>
      <p className='text-xs font-medium tracking-wider text-muted-foreground leading-relaxed'>
        Playback opens fullscreen. Collapse it anytime to keep listening from the dock, or press F
        to toggle.
      </p>
    </div>
  )
}
