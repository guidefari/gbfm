import { Button } from '@gbfm/ui'
import { CheckCircle2, ExternalLink, Loader2, Music } from 'lucide-react'
import type { RefObject } from 'react'
import type { TrackEntry } from './tracklist-editor'

interface UploadSummaryCardProps {
  audioRef: RefObject<HTMLAudioElement | null>
  audioUrl: string | null
  title: string
  tags: string[]
  tracklist: TrackEntry[]
  onTimeUpdate: (currentTime: number) => void
  onPublish: () => void
  onSaveDraft: () => void
  onDiscard: () => void
  isUploading: boolean
  uploadStep: string
}

export function UploadSummaryCard({
  audioRef,
  audioUrl,
  title,
  tags,
  tracklist,
  onTimeUpdate,
  onPublish,
  onSaveDraft,
  onDiscard,
  isUploading,
  uploadStep
}: UploadSummaryCardProps) {
  const isSuccess = uploadStep === 'success'

  return (
    <div className='space-y-6'>
      <div className='sticky p-6 rounded-sm shadow-xl top-8 bg-gb-darker-bg'>
        <div className='flex items-center gap-4 mb-6'>
          <div className='flex items-center justify-center w-16 h-16 rounded-sm bg-gb-pastel-green-2 animate-pulse'>
            <Music className='w-8 h-8 text-gb-darker-bg' />
          </div>
          <div className='flex-1 overflow-hidden'>
            <h3 className='text-lg font-bold truncate text-gb-pastel-green-1'>
              {title || 'Untitled Mix'}
            </h3>
            <p className='text-sm text-gb-highlight'>Ready to Publish</p>
          </div>
        </div>

        <div className='space-y-4'>
          {audioUrl && (
            /* biome-ignore lint/a11y/useMediaCaption: Audio player for mix summary, captions not applicable */
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
              controls
              className='w-full'
            />
          )}

          <div className='pt-6 border-t border-gb-pastel-green-2/20'>
            <h4 className='mb-4 text-xs font-bold tracking-widest uppercase text-muted-foreground'>
              Final Checks
            </h4>
            <div className='space-y-3'>
              <div className='flex items-center justify-between text-sm'>
                <span className='flex items-center gap-2 text-muted-foreground'>
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${title ? 'text-green-500' : 'text-muted-foreground'}`}
                  />
                  Title
                </span>
                <span className='font-mono text-xs'>{title.length} chars</span>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='flex items-center gap-2 text-muted-foreground'>
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${tracklist.length > 0 ? 'text-green-500' : 'text-muted-foreground'}`}
                  />
                  Tracklist
                </span>
                <span className='font-mono text-xs'>
                  {tracklist.length} tracks
                </span>
              </div>
              <div className='flex items-center justify-between text-sm'>
                <span className='flex items-center gap-2 text-muted-foreground'>
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${tags.length > 0 ? 'text-green-500' : 'text-muted-foreground'}`}
                  />
                  Genre Tags
                </span>
                <span className='font-mono text-xs'>
                  {tags.length} selected
                </span>
              </div>
            </div>
          </div>

          <Button
            onClick={onPublish}
            disabled={isUploading || isSuccess}
            className='flex items-center justify-center w-full gap-2 py-4 mt-4 font-bold rounded-sm bg-gb-pastel-green-2 hover:bg-gb-highlight text-gb-darker-bg'>
            {isUploading ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <>
                Publish Mix
                <ExternalLink className='w-4 h-4' />
              </>
            )}
          </Button>

          <Button
            onClick={onSaveDraft}
            disabled={isUploading || isSuccess}
            variant='outline'
            className='w-full border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:bg-gb-pastel-green-2/20'>
            Save as Draft
          </Button>

          <button
            type='button'
            onClick={onDiscard}
            className='w-full py-2 text-xs transition-colors text-muted-foreground hover:text-gb-pastel-green-1'>
            Cancel and discard
          </button>
        </div>
      </div>

      {tracklist.length > 0 && (
        <div className='p-6 border rounded-sm bg-gb-pastel-green-2/10 border-gb-pastel-green-2/20'>
          <h4 className='mb-4 text-sm font-bold text-gb-pastel-green-1'>
            Track Preview Links
          </h4>
          <div className='space-y-2'>
            {tracklist.map((t) => (
              <div
                key={t.id}
                className='flex items-center justify-between p-2 text-xs rounded-sm bg-gb-bg/50'>
                <span className='flex-1 font-medium truncate text-gb-default-text'>
                  {t.title}
                </span>
                <code className='px-2 py-0.5 rounded ml-2 bg-gb-pastel-green-2/20 text-gb-highlight'>
                  #t={t.time}s
                </code>
              </div>
            ))}
          </div>
          <p className='mt-4 text-[10px] font-bold text-center uppercase text-gb-pastel-green-2/60'>
            These anchors are generated automatically
          </p>
        </div>
      )}
    </div>
  )
}
