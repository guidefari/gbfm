import { Clock, Play, Plus, X } from 'lucide-react'
import type React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface TrackEntry {
  id: number
  time: number
  title: string
}

interface TracklistEditorProps {
  tracklist: TrackEntry[]
  currentTime: number
  onAddTrack: () => void
  onUpdateTrack: (index: number, title: string) => void
  onRemoveTrack: (id: number) => void
  onSeekTo: (seconds: number) => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function TracklistEditor({
  tracklist,
  currentTime,
  onAddTrack,
  onUpdateTrack,
  onRemoveTrack,
  onSeekTo
}: TracklistEditorProps) {
  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between p-4 border rounded-sm bg-gb-bg border-gb-pastel-green-2/20'>
        <div className='flex items-center gap-3'>
          <Clock className='w-5 h-5 text-gb-highlight' />
          <span className='font-mono text-lg font-bold text-gb-pastel-green-1'>
            {formatTime(currentTime)}
          </span>
        </div>
        <Button
          onClick={onAddTrack}
          className='bg-gb-pastel-green-2 hover:bg-gb-highlight text-gb-darker-bg'>
          <Plus className='w-4 h-4 mr-2' />
          Mark Track Start
        </Button>
      </div>

      <ScrollArea className='h-[400px] pr-2'>
        <div className='space-y-2'>
          {tracklist.length === 0 ? (
            <div className='py-12 text-center text-muted-foreground'>
              No tracks marked yet. Play the mix and hit "Mark Track Start" to
              capture timestamps.
            </div>
          ) : (
            tracklist.map((track, idx) => (
              <div
                key={track.id}
                className='flex items-center gap-3 p-3 transition-colors border rounded-sm group bg-gb-bg border-gb-pastel-green-2/20 hover:border-gb-highlight/50'>
                <button
                  type='button'
                  onClick={() => onSeekTo(track.time)}
                  className='flex items-center justify-center flex-shrink-0 w-10 h-10 transition-colors border rounded-sm bg-gb-darker-bg border-gb-pastel-green-2/30 text-gb-highlight hover:bg-gb-pastel-green-2/20'>
                  <Play className='w-3.5 h-3.5' fill='currentColor' />
                </button>
                <span className='w-12 font-mono text-sm text-muted-foreground'>
                  {formatTime(track.time)}
                </span>
                <Input
                  type='text'
                  value={track.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onUpdateTrack(idx, e.target.value)
                  }
                  className='flex-1 border-0 bg-transparent focus-visible:ring-0 text-gb-pastel-green-1'
                  placeholder='Enter track name...'
                />
                <button
                  type='button'
                  onClick={() => onRemoveTrack(track.id)}
                  className='p-2 transition-all opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400'>
                  <X className='w-4 h-4' />
                </button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
