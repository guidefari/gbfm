import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlayButtonProps {
  isActive: boolean
  isPlaying: boolean
  title: string
  onClick: () => void
}

export function PlayButton({ isActive, isPlaying, title, onClick }: PlayButtonProps) {
  const playLabel = title.split(' ')[0]

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-5 py-2 text-sm font-bold border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive && isPlaying
          ? 'bg-highlight text-highlight-foreground border-highlight'
          : 'border-border text-foreground/80 hover:border-highlight hover:text-highlight'
      )}>
      {isActive && isPlaying ? (
        <Pause size={14} fill='currentColor' />
      ) : (
        <Play size={14} fill='currentColor' />
      )}
      <span>{isActive && isPlaying ? 'playing' : `play ${playLabel}`}</span>
    </button>
  )
}
