import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { Button, Input, Label, Textarea, toast } from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { checkSavedTracksEffect, spotifyIdFromUrl } from '@/lib/spotify-pkce'
import { runAppEffect } from '@/runtime'
import { ImageUploadField } from './-ImageUploadField'
import { type PlaylistTrackRow, SortableTrackRow } from './-SortableTrackRow'

export interface PlaylistSummary {
  id: string
  title: string
  description: string | null
  coverImageUrl: string | null
  slug: string
  spotifyUrl?: string | null
}

interface PlaylistTracksApiRow {
  track: {
    id: string
    title: string
    artistNames: string[] | null
    coverImageUrl: string | null
  }
  position: number
  addedAt: string
  links: Array<{
    id: string
    platform: string
    url: string
  }>
}

interface SyncResult {
  playlistId: string
  queuedTrackCount: number
}

interface Props {
  playlist: PlaylistSummary
}

export function PlaylistEditor({ playlist }: Props) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(playlist.title)
  const [description, setDescription] = useState(playlist.description ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(playlist.coverImageUrl ?? '')
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [savedSpotifyTrackIds, setSavedSpotifyTrackIds] = useState<Map<string, boolean>>(new Map())
  const [spotifyTrackUrl, setSpotifyTrackUrl] = useState('')

  const tracksQuery = useQuery({
    queryKey: ['playlist-tracks', playlist.id],
    queryFn: async () =>
      fetcher<PlaylistTracksApiRow[]>(`${VPS_BASE_URL}/music/playlists/${playlist.id}/tracks`)
  })

  useEffect(() => {
    if (tracksQuery.data) {
      setOrderedIds(tracksQuery.data.map((r) => r.track.id))
    }
  }, [tracksQuery.data])

  useEffect(() => {
    if (!tracksQuery.data) return

    const spotifyTrackIds = Array.from(
      new Set(
        tracksQuery.data.flatMap((row) =>
          row.links.flatMap((link) => {
            if (link.platform !== 'spotify') return []
            const id = spotifyIdFromUrl(link.url)
            return id ? [id] : []
          })
        )
      )
    )

    let active = true
    runAppEffect(checkSavedTracksEffect(spotifyTrackIds))
      .then((results) => {
        if (active) setSavedSpotifyTrackIds(results)
      })
      .catch(() => {
        if (active) setSavedSpotifyTrackIds(new Map())
      })

    return () => {
      active = false
    }
  }, [tracksQuery.data])

  const trackMap = new Map<string, PlaylistTrackRow>()
  if (tracksQuery.data) {
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i]
      if (!id) continue
      const found = tracksQuery.data.find((r) => r.track.id === id)
      if (!found) continue
      trackMap.set(id, {
        trackId: found.track.id,
        position: i,
        title: found.track.title,
        artistNames: found.track.artistNames,
        coverImageUrl: found.track.coverImageUrl,
        links: found.links
      })
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const reorderMutation = useMutation({
    mutationFn: async (trackIds: string[]) =>
      fetcher(`${VPS_BASE_URL}/music/playlists/${playlist.id}/tracks/order`, {
        method: 'PUT',
        body: JSON.stringify({ trackIds })
      }),
    onError: (error: Error) => {
      toast({
        title: 'Reorder failed',
        description: error.message,
        variant: 'destructive'
      })
      tracksQuery.refetch()
    }
  })

  const removeMutation = useMutation({
    mutationFn: async (trackId: string) =>
      fetcher(`${VPS_BASE_URL}/music/playlists/${playlist.id}/tracks/${trackId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['playlist-tracks', playlist.id]
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Remove failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  const addSpotifyMutation = useMutation({
    mutationFn: async (url: string) =>
      fetcher(`${VPS_BASE_URL}/music/playlists/${playlist.id}/tracks/spotify`, {
        method: 'POST',
        body: JSON.stringify({ url })
      }),
    onSuccess: () => {
      setSpotifyTrackUrl('')
      queryClient.invalidateQueries({
        queryKey: ['playlist-tracks', playlist.id]
      })
      toast({ title: 'Track added' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Add failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  const syncLinksMutation = useMutation({
    mutationFn: async () =>
      fetcher<SyncResult>(`${VPS_BASE_URL}/music/playlists/${playlist.id}/sync-links`, {
        method: 'POST'
      }),
    onSuccess: (data) => {
      toast({
        title: 'Sync queued',
        description:
          data.queuedTrackCount > 0
            ? `Queued ${data.queuedTrackCount} tracks for background enrichment`
            : 'No Spotify source links found to sync'
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  const metadataMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; coverImageUrl?: string }) =>
      fetcher(`${VPS_BASE_URL}/music/playlists/${playlist.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      toast({ title: 'Playlist updated' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = orderedIds.indexOf(String(active.id))
    const newIndex = orderedIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return

    const next = arrayMove(orderedIds, oldIndex, newIndex)
    setOrderedIds(next)
    reorderMutation.mutate(next)
  }

  const handleSaveMetadata = (e: React.FormEvent) => {
    e.preventDefault()
    metadataMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      coverImageUrl: coverImageUrl.trim() || undefined
    })
  }

  const handleAddSpotify = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = spotifyTrackUrl.trim()
    if (!trimmed) return
    addSpotifyMutation.mutate(trimmed)
  }

  const metadataDirty =
    title !== playlist.title ||
    description !== (playlist.description ?? '') ||
    coverImageUrl !== (playlist.coverImageUrl ?? '')

  return (
    <div className='grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:h-full lg:min-h-0'>
      <section className='flex flex-col lg:min-h-0 lg:overflow-hidden'>
        <form
          onSubmit={handleSaveMetadata}
          className='flex flex-col gap-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]'>
          <div className='flex items-start gap-4'>
            <ImageUploadField
              label='Cover image'
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              variant='compact'
              size={144}
              hideLabel
            />
            <div className='flex flex-col flex-1 min-w-0 gap-2'>
              <Label
                htmlFor={`title-${playlist.id}`}
                className='text-xs uppercase tracking-wide text-muted-foreground'>
                Title
              </Label>
              <Input
                id={`title-${playlist.id}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className='text-lg font-semibold h-auto py-2'
              />
              <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                <span className='truncate'>{playlist.slug}</span>
                {playlist.spotifyUrl && (
                  <a
                    href={playlist.spotifyUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 underline hover:text-foreground'
                    title={playlist.spotifyUrl}>
                    Source
                    <ExternalLink className='w-3 h-3' />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className='space-y-1'>
            <Label
              htmlFor={`desc-${playlist.id}`}
              className='text-xs uppercase tracking-wide text-muted-foreground'>
              Description
            </Label>
            <Textarea
              id={`desc-${playlist.id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className='min-h-32'
            />
          </div>
          {metadataDirty && (
            <div className='sticky bottom-0 flex items-center justify-end gap-2 py-2 bg-background/90 backdrop-blur'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => {
                  setTitle(playlist.title)
                  setDescription(playlist.description ?? '')
                  setCoverImageUrl(playlist.coverImageUrl ?? '')
                }}
                disabled={metadataMutation.isPending}>
                Discard
              </Button>
              <Button type='submit' size='sm' disabled={metadataMutation.isPending}>
                {metadataMutation.isPending ? (
                  <>
                    <Loader2 className='w-3 h-3 mr-2 animate-spin' />
                    Saving
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          )}
        </form>
      </section>

      <section className='flex flex-col gap-3 lg:min-h-0 lg:overflow-hidden'>
        <div className='flex items-center justify-between gap-2 shrink-0'>
          <h2 className='text-lg font-semibold'>
            Tracks{' '}
            <span className='text-sm font-normal text-muted-foreground'>({orderedIds.length})</span>
          </h2>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => syncLinksMutation.mutate()}
              disabled={syncLinksMutation.isPending}>
              {syncLinksMutation.isPending ? (
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
              ) : (
                <RefreshCw className='w-4 h-4 mr-2' />
              )}
              Sync links
            </Button>
            {reorderMutation.isPending && (
              <span className='text-xs text-muted-foreground'>
                <Loader2 className='inline w-3 h-3 mr-1 animate-spin' />
                Saving order
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleAddSpotify} className='flex gap-2 shrink-0'>
          <Input
            id={`add-spotify-${playlist.id}`}
            type='url'
            placeholder='Paste Spotify track URL to add'
            value={spotifyTrackUrl}
            onChange={(e) => setSpotifyTrackUrl(e.target.value)}
            disabled={addSpotifyMutation.isPending}
            className='h-9'
          />
          <Button
            type='submit'
            size='sm'
            disabled={addSpotifyMutation.isPending || !spotifyTrackUrl.trim()}>
            {addSpotifyMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : 'Add'}
          </Button>
        </form>

        {tracksQuery.isLoading && (
          <div className='text-sm text-muted-foreground'>Loading tracks…</div>
        )}

        {tracksQuery.data && orderedIds.length === 0 && (
          <div className='text-sm text-muted-foreground'>No tracks yet.</div>
        )}

        <div className='lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]'>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              <div className='space-y-1'>
                {orderedIds.map((id) => {
                  const row = trackMap.get(id)
                  if (!row) return null
                  return (
                    <SortableTrackRow
                      key={id}
                      track={row}
                      savedSpotifyTrackIds={savedSpotifyTrackIds}
                      onSpotifyTrackSaved={(spotifyTrackId) =>
                        setSavedSpotifyTrackIds((current) =>
                          new Map(current).set(spotifyTrackId, true)
                        )
                      }
                      onRemove={(trackId) => removeMutation.mutate(trackId)}
                      removeDisabled={removeMutation.isPending}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </section>
    </div>
  )
}
