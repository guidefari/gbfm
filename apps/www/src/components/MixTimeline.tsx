import type { SelectAudio } from '@gbfm/vps/schemas'
import { cn } from '@/lib/utils'
import { useAudioPlayerPlaybackState } from '@/store/audioPlayer'

interface MixTimelineProps {
  children: React.ReactNode
}

export function MixTimeline({ children }: MixTimelineProps) {
  return <div>{children}</div>
}

interface MixTimelineItemProps {
  mix: SelectAudio
  children: React.ReactNode
}

export function MixTimelineItem({ mix, children }: MixTimelineItemProps) {
  const { nowPlayingContext } = useAudioPlayerPlaybackState()
  const isActive = nowPlayingContext?.title === mix.title

  return (
    <div className='group relative grid grid-cols-[1rem_1fr] gap-x-4 pb-6 last:pb-0 [&:first-child_.timeline-line]:top-3 [&:last-child_.timeline-line]:hidden'>
      <div
        className={cn(
          'timeline-line absolute left-2 top-0 bottom-0 w-px -translate-x-1/2 transition-opacity duration-300',
          isActive
            ? 'bg-highlight/40 opacity-100'
            : 'bg-border opacity-75 group-hover:opacity-95'
        )}
      />
      <div className='flex items-center justify-center'>
        <div
          className={cn(
            'w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300 ring-2 ring-background',
            isActive
              ? 'bg-highlight shadow-[0_0_8px_hsl(var(--highlight)/0.35)]'
              : 'bg-border group-hover:bg-highlight/60'
          )}
        />
      </div>
      <span
        className={cn(
          'inline-flex w-fit items-center gap-2 py-0.5 text-[11px] font-mono tracking-widest uppercase transition-colors duration-300 sm:gap-3 sm:text-xs',
          isActive
            ? 'text-highlight'
            : 'text-highlight/75 group-hover:text-highlight/90'
        )}>
        <span
          className={cn(
            'h-px w-4 transition-colors duration-300',
            isActive
              ? 'bg-highlight/60'
              : 'bg-border group-hover:bg-highlight/30'
          )}
        />
        {new Date(mix.createdAt)
          .toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
          .toUpperCase()}
      </span>

      <div />
      <div className='pt-2 pb-1'>{children}</div>
    </div>
  )
}
