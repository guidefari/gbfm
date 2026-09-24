import { Loader2, Music4, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'

export function MusicCover({
  url,
  isResolving,
  size
}: {
  url: string | null
  isResolving: boolean
  size: 'md' | 'sm'
}) {
  const [failed, setFailed] = useState(false)
  const dimension = size === 'md' ? 'size-16' : 'size-12'
  const showImage = url && !failed

  return (
    <div className={`${dimension} flex shrink-0 items-center justify-center bg-muted`}>
      {showImage ? (
        <img
          src={url}
          alt='Cover art'
          className='size-full object-cover'
          onError={() => setFailed(true)}
        />
      ) : isResolving ? (
        <Loader2 className='size-4 animate-spin text-muted-foreground' />
      ) : (
        <Music4 className='size-5 text-muted-foreground' />
      )}
    </div>
  )
}

export function MusicSlot({
  hasEntity,
  musicUrl,
  isResolving,
  coverImageUrl,
  entityTitle,
  entityMeta,
  onMusicUrlChange,
  onClear,
  linksSlot
}: {
  hasEntity: boolean
  musicUrl: string
  isResolving: boolean
  coverImageUrl: string | null
  entityTitle: string | null
  entityMeta: string
  onMusicUrlChange: (value: string) => void
  onClear: () => void
  linksSlot?: ReactNode
}) {
  if (!hasEntity) {
    return (
      <div className='flex h-14 items-center gap-3 border border-dashed border-gb-pastel-green-2/40 px-3 focus-within:border-highlight/60'>
        <Music4 className='size-4 shrink-0 text-muted-foreground' />
        <input
          value={musicUrl}
          onChange={(event) => onMusicUrlChange(event.target.value)}
          placeholder='Paste a Spotify, Apple Music or Bandcamp link'
          className='h-full min-w-0 flex-1 bg-transparent text-sm text-gb-pastel-green-2 outline-none'
        />
        {isResolving ? (
          <span className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Loader2 className='size-3.5 animate-spin' />
            Resolving…
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center gap-3 border border-gb-pastel-green-2/25 bg-black/20 p-2.5'>
        <MusicCover url={coverImageUrl} isResolving={isResolving} size='md' />
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <div className='truncate text-base font-medium text-gb-pastel-green-2'>{entityTitle}</div>
          <div className='truncate text-xs text-muted-foreground'>{entityMeta}</div>
          {musicUrl ? (
            <div className='truncate text-[11px] text-muted-foreground/75'>{musicUrl}</div>
          ) : null}
        </div>
        <button
          type='button'
          aria-label='Remove music'
          onClick={onClear}
          className='flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-highlight'>
          <X className='size-4' />
        </button>
      </div>
      {linksSlot}
    </div>
  )
}
