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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { ImageUploadField } from './-ImageUploadField'
import { type PlaylistTrackRow, SortableTrackRow } from './-SortableTrackRow'

export interface PlaylistSummary {
  id: string
  title: string
  description: string | null
  coverImageUrl: string | null
  slug: string
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

interface Props {
  playlist: PlaylistSummary
}

export function PlaylistEditor({ playlist }: Props) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(playlist.title)
  const [description, setDescription] = useState(playlist.description ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(
    playlist.coverImageUrl ?? ''
  )
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [spotifyTrackUrl, setSpotifyTrackUrl] = useState('')

  const tracksQuery = useQuery({
    queryKey: ['playlist-tracks', playlist.id],
    queryFn: async () =>
      fetcher<PlaylistTracksApiRow[]>(
        `${VPS_BASE_URL}/music/playlists/${playlist.id}/tracks`
      )
  })

  useEffect(() => {
    if (tracksQuery.data) {
      setOrderedIds(tracksQuery.data.map((r) => r.track.id))
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
      fetcher(
        `${VPS_BASE_URL}/music/playlists/${playlist.id}/tracks/${trackId}`,
        { method: 'DELETE' }
      ),
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

  const metadataMutation = useMutation({
    mutationFn: async (data: {
      title: string
      description: string | null
      coverImageUrl: string | null
    }) =>
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

    const oldIndex = orderedIds.indexOf(active.id as string)
    const newIndex = orderedIds.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return

    const next = arrayMove(orderedIds, oldIndex, newIndex)
    setOrderedIds(next)
    reorderMutation.mutate(next)
  }

  const handleSaveMetadata = (e: React.FormEvent) => {
    e.preventDefault()
    metadataMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      coverImageUrl: coverImageUrl.trim() || null
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
    <div className='grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'>
      <section className='space-y-4'>
        <h2 className='text-lg font-semibold'>Metadata</h2>
        <form onSubmit={handleSaveMetadata} className='space-y-3'>
          <div className='space-y-1'>
            <Label htmlFor={`title-${playlist.id}`}>Title</Label>
            <Input
              id={`title-${playlist.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor={`desc-${playlist.id}`}>Description</Label>
            <Textarea
              id={`desc-${playlist.id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className='min-h-24'
            />
          </div>
          <ImageUploadField
            label='Cover image'
            value={coverImageUrl}
            onChange={setCoverImageUrl}
          />
          <Button
            type='submit'
            size='sm'
            disabled={!metadataDirty || metadataMutation.isPending}>
            {metadataMutation.isPending ? (
              <>
                <Loader2 className='w-3 h-3 mr-2 animate-spin' />
                Saving
              </>
            ) : (
              'Save metadata'
            )}
          </Button>
        </form>
      </section>

      <section className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold'>
            Tracks ({orderedIds.length})
          </h2>
          {reorderMutation.isPending && (
            <span className='text-xs text-muted-foreground'>
              <Loader2 className='inline w-3 h-3 mr-1 animate-spin' />
              Saving order
            </span>
          )}
        </div>

        <form onSubmit={handleAddSpotify} className='space-y-1'>
          <Label htmlFor={`add-spotify-${playlist.id}`} className='text-xs'>
            Add track by Spotify URL
          </Label>
          <div className='flex gap-2'>
            <Input
              id={`add-spotify-${playlist.id}`}
              type='url'
              placeholder='https://open.spotify.com/track/...'
              value={spotifyTrackUrl}
              onChange={(e) => setSpotifyTrackUrl(e.target.value)}
              disabled={addSpotifyMutation.isPending}
            />
            <Button
              type='submit'
              disabled={
                addSpotifyMutation.isPending || !spotifyTrackUrl.trim()
              }>
              {addSpotifyMutation.isPending ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                'Add'
              )}
            </Button>
          </div>
        </form>

        {tracksQuery.isLoading && (
          <div className='text-sm text-muted-foreground'>Loading tracks…</div>
        )}

        {tracksQuery.data && orderedIds.length === 0 && (
          <div className='text-sm text-muted-foreground'>No tracks yet.</div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}>
          <SortableContext
            items={orderedIds}
            strategy={verticalListSortingStrategy}>
            <div className='space-y-1'>
              {orderedIds.map((id) => {
                const row = trackMap.get(id)
                if (!row) return null
                return (
                  <SortableTrackRow
                    key={id}
                    track={row}
                    onRemove={(trackId) => removeMutation.mutate(trackId)}
                    removeDisabled={removeMutation.isPending}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      </section>
    </div>
  )
}
