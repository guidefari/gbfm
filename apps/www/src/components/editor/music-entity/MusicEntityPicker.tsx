import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label
} from '@gbfm/ui'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Music4, Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Artwork } from '@/components/common/Artwork'
import { apiUrl, fetcher, useAdminAlbums, useAdminTracks } from '@/lib/http'
import {
  musicEntityTypes,
  serializeMusicEntity,
  type MusicEntityReference,
  type MusicEntityType
} from './music-entity-markdown'

type PlaylistSummary = {
  readonly id: string
  readonly title: string
  readonly coverImageUrl: string | null
}

type PickerEntity = MusicEntityReference & {
  readonly title: string
  readonly artists: string | null
  readonly coverImageUrl: string | null
}

export interface MusicEntityPickerProps {
  readonly onInsert: (markdown: string) => void
  readonly portalContainer?: HTMLElement | null
}

export function MusicEntityPicker({ onInsert, portalContainer }: MusicEntityPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<MusicEntityType | null>(null)
  const searchId = useId()
  const entities = useMusicEntityPickerEntities()

  const matchingEntities = useMemo(
    () => filterMusicEntities(entities.data, query, type),
    [entities.data, query, type]
  )

  const insertEntity = (entity: PickerEntity) => {
    onInsert(serializeMusicEntity(entity))
    setOpen(false)
    setQuery('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type='button' variant='ghost' size='sm' className='h-9 gap-1.5 px-2 text-xs'>
          <Music4 className='size-4' />
          Music
        </Button>
      </DialogTrigger>
      <DialogContent
        container={portalContainer}
        className='max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl overflow-hidden p-0'>
        <DialogHeader className='min-w-0 border-b border-border/70 px-6 py-5 pr-12'>
          <DialogTitle>Embed music</DialogTitle>
          <DialogDescription className='max-w-xl text-sm leading-relaxed'>
            Search the GBFM catalog and add an album, track, or playlist to your story.
          </DialogDescription>
        </DialogHeader>
        <div className='min-w-0 space-y-5 overflow-hidden px-6 pb-6'>
          <div className='space-y-2'>
            <Label htmlFor={searchId}>Search music catalog</Label>
            <div className='relative'>
              <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                id={searchId}
                type='search'
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='Search titles and artists'
                className='pl-9'
              />
            </div>
          </div>
          <fieldset>
            <legend className='mb-2 text-sm font-medium'>Show</legend>
            <div className='grid grid-cols-2 gap-2 sm:flex sm:flex-wrap'>
              <Button
                type='button'
                size='sm'
                variant={type === null ? 'default' : 'outline'}
                aria-pressed={type === null}
                onClick={() => setType(null)}
                className='h-9 w-full px-3.5 text-sm sm:w-auto'>
                All
              </Button>
              {musicEntityTypes.map((entityType) => (
                <Button
                  key={entityType}
                  type='button'
                  size='sm'
                  variant={type === entityType ? 'default' : 'outline'}
                  aria-pressed={type === entityType}
                  onClick={() => setType(entityType)}
                  className='h-9 w-full px-3.5 text-sm capitalize sm:w-auto'>
                  {entityType}
                </Button>
              ))}
            </div>
          </fieldset>
          <MusicEntityResults
            entities={matchingEntities}
            isPending={entities.isPending}
            hasError={entities.hasError}
            onInsert={insertEntity}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function useMusicEntityPickerEntities() {
  const albums = useAdminAlbums()
  const tracks = useAdminTracks()
  const playlists = useQuery<ReadonlyArray<PlaylistSummary>>({
    queryKey: ['playlists'],
    queryFn: () => fetcher<ReadonlyArray<PlaylistSummary>>(apiUrl('/music/playlists'))
  })

  const data = [
    ...(albums.data ?? []).map(
      (album): PickerEntity => ({
        id: album.id,
        type: 'album',
        title: album.title,
        artists: album.artistNames?.join(', ') ?? null,
        coverImageUrl: album.coverImageUrl
      })
    ),
    ...(tracks.data ?? []).map(
      (track): PickerEntity => ({
        id: track.id,
        type: 'track',
        title: track.title,
        artists: track.artistNames?.join(', ') ?? null,
        coverImageUrl: track.coverImageUrl
      })
    ),
    ...(playlists.data ?? []).map(
      (playlist): PickerEntity => ({
        id: playlist.id,
        type: 'playlist',
        title: playlist.title,
        artists: null,
        coverImageUrl: playlist.coverImageUrl
      })
    )
  ]

  return {
    data,
    isPending: albums.isPending || tracks.isPending || playlists.isPending,
    hasError: albums.isError || tracks.isError || playlists.isError
  }
}

function filterMusicEntities(
  entities: ReadonlyArray<PickerEntity>,
  query: string,
  type: MusicEntityType | null
): ReadonlyArray<PickerEntity> {
  const searchTerm = query.trim().toLocaleLowerCase()

  return entities.filter((entity) => {
    if (type !== null && entity.type !== type) return false
    if (!searchTerm) return true
    return `${entity.title} ${entity.artists ?? ''}`.toLocaleLowerCase().includes(searchTerm)
  })
}

function MusicEntityResults({
  entities,
  isPending,
  hasError,
  onInsert
}: {
  readonly entities: ReadonlyArray<PickerEntity>
  readonly isPending: boolean
  readonly hasError: boolean
  readonly onInsert: (entity: PickerEntity) => void
}) {
  if (isPending) {
    return (
      <div
        role='status'
        className='flex min-h-48 items-center justify-center gap-2 text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' />
        Loading music catalog
      </div>
    )
  }

  if (hasError) {
    return (
      <p role='alert' className='min-h-48 py-12 text-center text-destructive'>
        Unable to load the music catalog. Please try again.
      </p>
    )
  }

  if (entities.length === 0) {
    return <p className='min-h-48 py-12 text-center text-muted-foreground'>No matching entities.</p>
  }

  return (
    <ul className='m-0 max-h-[min(24rem,45vh)] min-w-0 divide-y overflow-y-auto rounded-md border border-border/70 bg-card/40'>
      {entities.map((entity) => (
        <li key={`${entity.type}-${entity.id}`} className='m-0'>
          <button
            type='button'
            onClick={() => onInsert(entity)}
            className='flex min-w-0 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'>
            <div className='flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted'>
              {entity.coverImageUrl ? (
                <Artwork
                  src={entity.coverImageUrl}
                  alt=''
                  width={48}
                  height={48}
                  sizes='48px'
                  className='size-full object-cover'
                />
              ) : (
                <Music4 className='size-5 text-muted-foreground' />
              )}
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate font-medium'>{entity.title}</p>
              <p className='truncate text-sm text-muted-foreground'>
                {entity.artists ?? entity.type}
              </p>
            </div>
            <span className='hidden shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:inline'>
              {entity.type}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
