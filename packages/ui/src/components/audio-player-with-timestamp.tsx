import { Music } from 'lucide-react'
import { forwardRef } from 'react'

interface AudioPlayerWithTimestampProps {
  audioUrl: string | null
  title: string
  onTimeUpdate: (currentTime: number) => void
}

export const AudioPlayerWithTimestamp = forwardRef<
  HTMLAudioElement,
  AudioPlayerWithTimestampProps
>(({ audioUrl, title, onTimeUpdate }, ref) => {
  if (!audioUrl) {
    return (
      <div className='flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-sm border-gb-pastel-green-2/30'>
        <Music className='w-12 h-12 mb-3 text-gb-pastel-green-2' />
        <p className='text-sm text-muted-foreground'>
          Upload an audio file to enable the player
        </p>
      </div>
    )
  }

  return (
    <div className='p-6 rounded-sm bg-gb-darker-bg'>
      <div className='flex items-center gap-4 mb-6'>
        <div className='flex items-center justify-center w-16 h-16 rounded-sm bg-gb-pastel-green-2'>
          <Music className='w-8 h-8 text-gb-darker-bg' />
        </div>
        <div className='flex-1 overflow-hidden'>
          <h3 className='text-lg font-bold truncate text-gb-pastel-green-1'>
            {title || 'Untitled Mix'}
          </h3>
          <p className='text-sm text-gb-highlight'>Ready to Publish</p>
        </div>
      </div>

      {/* biome-ignore lint/a11y/useMediaCaption: Audio player for mix upload, captions not applicable */}
      <audio
        ref={ref}
        src={audioUrl}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        controls
        className='w-full'
      />
    </div>
  )
})

AudioPlayerWithTimestamp.displayName = 'AudioPlayerWithTimestamp'
