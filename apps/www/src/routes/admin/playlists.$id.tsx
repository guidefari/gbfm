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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SelectPlaylistTrack } from '@gbfm/vps/schemas'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  GripVertical,
  Loader2,
  Music,
  Pencil,
  Plus,
  Trash2,
  X
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import {
  useAddPlaylistTrack,
  useEnrichTrackFromUrl,
  usePlaylist,
  useRemovePlaylistTrack,
  useReorderPlaylistTracks,
  useUpdatePlaylist,
  useUpdatePlaylistTrack
} from '@/lib/http'

export const Route = createFileRoute('/admin/playlists/$id')({
  component: PlaylistDetailPage
})

// ---------------------------------------------------------------------------
// Sortable track row
// ---------------------------------------------------------------------------

interface TrackRowProps {
  track: SelectPlaylistTrack
  onEdit: (track: SelectPlaylistTrack) => void
  onRemove: (trackId: string) => void
}

function TrackRow({ track, onEdit, onRemove }: TrackRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: track.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 group'>
      <button
        type='button'
        {...attributes}
        {...listeners}
        className='cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0'
        aria-label='Drag to reorder'>
        <GripVertical className='h-4 w-4' />
      </button>

      <span className='text-xs text-muted-foreground w-5 text-right shrink-0'>
        {track.position + 1}
      </span>

      {track.thumbnailUrl ? (
        <img
          src={track.thumbnailUrl}
          alt=''
          className='h-8 w-8 rounded object-cover shrink-0'
        />
      ) : (
        <div className='h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0'>
          <Music className='h-3 w-3 text-muted-foreground' />
        </div>
      )}

      <div className='min-w-0 flex-1'>
        <a
          href={track.url}
          target='_blank'
          rel='noopener noreferrer'
          className='text-sm font-medium truncate block hover:underline'>
          {track.title}
        </a>
        {track.artistNames && track.artistNames.length > 0 && (
          <p className='text-xs text-muted-foreground truncate'>
            {track.artistNames.join(', ')}
          </p>
        )}
      </div>

      <div className='flex items-center gap-2 shrink-0'>
        {track.bpm && (
          <Badge variant='outline' className='text-xs'>
            {track.bpm} BPM
          </Badge>
        )}
        {track.musicalKey && (
          <Badge variant='outline' className='text-xs'>
            {track.musicalKey}
          </Badge>
        )}
        {track.notes && (
          <span
            className='text-xs text-muted-foreground max-w-[120px] truncate hidden sm:block'
            title={track.notes}>
            {track.notes}
          </span>
        )}
      </div>

      <div className='flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0'>
        <Button
          variant='ghost'
          size='icon'
          className='h-7 w-7'
          onClick={() => onEdit(track)}>
          <Pencil className='h-3 w-3' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='h-7 w-7 text-muted-foreground hover:text-destructive'
          onClick={() => onRemove(track.id)}>
          <Trash2 className='h-3 w-3' />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add track form (paste URL → auto-enrich)
// ---------------------------------------------------------------------------

interface AddTrackFormProps {
  playlistId: string
  onSuccess: () => void
}

function AddTrackForm({ playlistId, onSuccess }: AddTrackFormProps) {
  const [url, setUrl] = useState('')
  const [confirmedUrl, setConfirmedUrl] = useState('')
  const [manualTitle, setManualTitle] = useState('')
  const [manualArtist, setManualArtist] = useState('')
  const [bpm, setBpm] = useState('')
  const [musicalKey, setMusicalKey] = useState('')
  const [notes, setNotes] = useState('')

  const { data: enriched, isLoading: enriching } =
    useEnrichTrackFromUrl(confirmedUrl)
  const { mutateAsync: addTrack, isPending: adding } =
    useAddPlaylistTrack(playlistId)

  // When enrichment resolves, pre-fill manual fields
  useEffect(() => {
    if (enriched) {
      setManualTitle(enriched.title ?? '')
      setManualArtist(enriched.artist ?? '')
    }
  }, [enriched])

  function handleUrlBlur() {
    const trimmed = url.trim()
    if (trimmed && trimmed !== confirmedUrl) {
      setConfirmedUrl(trimmed)
    }
  }

  async function handleAdd() {
    const trackUrl = confirmedUrl || url.trim()
    const title = manualTitle.trim() || enriched?.title || 'Unknown'
    const platform = enriched?.platform ?? 'other'
    if (!trackUrl) return

    try {
      await addTrack({
        url: trackUrl,
        platform,
        title,
        artistNames: manualArtist.trim()
          ? [manualArtist.trim()]
          : enriched?.artist
            ? [enriched.artist]
            : [],
        thumbnailUrl: enriched?.thumbnailUrl,
        durationMs: enriched?.duration ? enriched.duration * 1000 : undefined,
        bpm: bpm.trim() || undefined,
        musicalKey: musicalKey.trim() || undefined,
        notes: notes.trim() || undefined
      })
      setUrl('')
      setConfirmedUrl('')
      setManualTitle('')
      setManualArtist('')
      setBpm('')
      setMusicalKey('')
      setNotes('')
      onSuccess()
    } catch {
      toast({ title: 'Failed to add track', variant: 'destructive' })
    }
  }

  return (
    <div className='rounded-md border border-dashed border-border p-4 space-y-3'>
      <p className='text-sm font-medium'>Add a track</p>

      <div className='space-y-1'>
        <Label htmlFor='track-url' className='text-xs'>
          URL (Spotify, Bandcamp, Apple Music…)
        </Label>
        <div className='flex gap-2'>
          <Input
            id='track-url'
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder='https://open.spotify.com/track/...'
            className='flex-1'
          />
          {enriching && (
            <Loader2 className='h-4 w-4 animate-spin self-center text-muted-foreground' />
          )}
        </div>
      </div>

      {(enriched || confirmedUrl) && (
        <div className='grid grid-cols-2 gap-2'>
          <div className='space-y-1'>
            <Label htmlFor='track-title' className='text-xs'>
              Title
            </Label>
            <Input
              id='track-title'
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder={enriched?.title ?? 'Title'}
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='track-artist' className='text-xs'>
              Artist
            </Label>
            <Input
              id='track-artist'
              value={manualArtist}
              onChange={(e) => setManualArtist(e.target.value)}
              placeholder={enriched?.artist ?? 'Artist'}
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='track-bpm' className='text-xs'>
              BPM
            </Label>
            <Input
              id='track-bpm'
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              placeholder='128'
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='track-key' className='text-xs'>
              Key (e.g. 4A, 11B)
            </Label>
            <Input
              id='track-key'
              value={musicalKey}
              onChange={(e) => setMusicalKey(e.target.value)}
              placeholder='4A'
            />
          </div>
          <div className='col-span-2 space-y-1'>
            <Label htmlFor='track-notes' className='text-xs'>
              Notes / cue points
            </Label>
            <Textarea
              id='track-notes'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='Start at 1:30, mix out at 4:00…'
              className='min-h-[64px]'
            />
          </div>
        </div>
      )}

      <Button
        size='sm'
        onClick={handleAdd}
        disabled={adding || (!url.trim() && !confirmedUrl)}>
        {adding ? (
          <Loader2 className='mr-1 h-4 w-4 animate-spin' />
        ) : (
          <Plus className='mr-1 h-4 w-4' />
        )}
        Add track
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edit track dialog
// ---------------------------------------------------------------------------

interface EditTrackDialogProps {
  track: SelectPlaylistTrack | null
  playlistId: string
  onClose: () => void
}

function EditTrackDialog({ track, playlistId, onClose }: EditTrackDialogProps) {
  const { mutateAsync: updateTrack, isPending } = useUpdatePlaylistTrack(
    playlistId,
    track?.id ?? ''
  )

  const [form, setForm] = useState({
    title: track?.title ?? '',
    artist: track?.artistNames?.[0] ?? '',
    bpm: track?.bpm ?? '',
    musicalKey: track?.musicalKey ?? '',
    notes: track?.notes ?? ''
  })

  useEffect(() => {
    if (track) {
      setForm({
        title: track.title,
        artist: track.artistNames?.[0] ?? '',
        bpm: track.bpm ?? '',
        musicalKey: track.musicalKey ?? '',
        notes: track.notes ?? ''
      })
    }
  }, [track])

  async function handleSave() {
    if (!track) return
    try {
      await updateTrack({
        title: form.title.trim() || undefined,
        artistNames: form.artist.trim() ? [form.artist.trim()] : undefined,
        bpm: form.bpm.trim() || undefined,
        musicalKey: form.musicalKey.trim() || undefined,
        notes: form.notes.trim() || undefined
      })
      toast({ title: 'Track updated' })
      onClose()
    } catch {
      toast({ title: 'Failed to update track', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={Boolean(track)} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Track</DialogTitle>
        </DialogHeader>
        <div className='space-y-3 py-2'>
          <div className='space-y-1'>
            <Label htmlFor='edit-title' className='text-xs'>
              Title
            </Label>
            <Input
              id='edit-title'
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='edit-artist' className='text-xs'>
              Artist
            </Label>
            <Input
              id='edit-artist'
              value={form.artist}
              onChange={(e) =>
                setForm((p) => ({ ...p, artist: e.target.value }))
              }
            />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-1'>
              <Label htmlFor='edit-bpm' className='text-xs'>
                BPM
              </Label>
              <Input
                id='edit-bpm'
                value={form.bpm}
                onChange={(e) =>
                  setForm((p) => ({ ...p, bpm: e.target.value }))
                }
                placeholder='128'
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='edit-key' className='text-xs'>
                Key
              </Label>
              <Input
                id='edit-key'
                value={form.musicalKey}
                onChange={(e) =>
                  setForm((p) => ({ ...p, musicalKey: e.target.value }))
                }
                placeholder='4A'
              />
            </div>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='edit-notes' className='text-xs'>
              Notes
            </Label>
            <Textarea
              id='edit-notes'
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
              className='min-h-[80px]'
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function PlaylistDetailPage() {
  const { id } = Route.useParams()
  const { data: playlist, isPending } = usePlaylist(id)
  const { mutateAsync: removeTrack } = useRemovePlaylistTrack(id)
  const { mutateAsync: reorderTracks } = useReorderPlaylistTracks(id)
  const { mutateAsync: updatePlaylist } = useUpdatePlaylist(id)

  const [localTracks, setLocalTracks] = useState<SelectPlaylistTrack[]>([])
  const [editingTrack, setEditingTrack] = useState<SelectPlaylistTrack | null>(
    null
  )
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')

  // Keep local tracks in sync with server data
  useEffect(() => {
    if (playlist?.tracks) {
      setLocalTracks(
        [...playlist.tracks].sort((a, b) => a.position - b.position)
      )
    }
  }, [playlist?.tracks])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = localTracks.findIndex((t) => t.id === active.id)
      const newIndex = localTracks.findIndex((t) => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = [...localTracks]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)
      // Optimistic update
      setLocalTracks(reordered)

      try {
        await reorderTracks(reordered.map((t) => t.id))
      } catch {
        // Revert
        setLocalTracks(localTracks)
        toast({ title: 'Failed to save order', variant: 'destructive' })
      }
    },
    [localTracks, reorderTracks]
  )

  async function handleRemove(trackId: string) {
    const prev = localTracks
    setLocalTracks((ts) => ts.filter((t) => t.id !== trackId))
    try {
      await removeTrack(trackId)
    } catch {
      setLocalTracks(prev)
      toast({ title: 'Failed to remove track', variant: 'destructive' })
    }
  }

  async function handleTitleSave() {
    if (!titleInput.trim() || titleInput === playlist?.title) {
      setEditingTitle(false)
      return
    }
    try {
      await updatePlaylist({ title: titleInput.trim() })
      setEditingTitle(false)
      toast({ title: 'Playlist renamed' })
    } catch {
      toast({ title: 'Failed to rename', variant: 'destructive' })
    }
  }

  if (isPending) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className='container mx-auto max-w-3xl py-8 px-4'>
        <p className='text-muted-foreground'>Playlist not found.</p>
        <Link
          to='/admin'
          search={{ tab: 'playlists' }}
          className='mt-4 inline-flex text-sm underline'>
          Back to admin
        </Link>
      </div>
    )
  }

  return (
    <div className='container mx-auto max-w-3xl py-8 px-4 space-y-6'>
      {/* Header */}
      <div className='flex items-start gap-4'>
        <Link
          to='/admin'
          className='mt-1 text-muted-foreground hover:text-foreground'>
          <ArrowLeft className='h-4 w-4' />
        </Link>
        <div className='flex-1 min-w-0'>
          {editingTitle ? (
            <div className='flex items-center gap-2'>
              <Input
                autoFocus
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave()
                  if (e.key === 'Escape') setEditingTitle(false)
                }}
                className='text-xl font-bold h-auto py-0 border-0 border-b rounded-none focus-visible:ring-0 px-0'
              />
              <Button size='sm' variant='ghost' onClick={handleTitleSave}>
                Save
              </Button>
              <Button
                size='sm'
                variant='ghost'
                onClick={() => setEditingTitle(false)}>
                <X className='h-3 w-3' />
              </Button>
            </div>
          ) : (
            <button
              type='button'
              className='text-left group'
              onClick={() => {
                setTitleInput(playlist.title)
                setEditingTitle(true)
              }}>
              <h1 className='text-xl font-bold group-hover:underline decoration-dashed'>
                {playlist.title}
              </h1>
            </button>
          )}
          <p className='text-sm text-muted-foreground mt-1'>
            {localTracks.length} track{localTracks.length !== 1 ? 's' : ''}
            {playlist.isPublic ? ' · public' : ' · private'}
          </p>
        </div>
        <Button
          size='sm'
          variant='outline'
          onClick={() => setShowAddForm((v) => !v)}>
          <Plus className='mr-1 h-4 w-4' />
          Add track
        </Button>
      </div>

      {/* Add track form */}
      {showAddForm && (
        <AddTrackForm
          playlistId={id}
          onSuccess={() => {
            toast({ title: 'Track added' })
          }}
        />
      )}

      {/* Track list */}
      {localTracks.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg'>
          <Music className='h-8 w-8 text-muted-foreground mb-3' />
          <p className='text-sm text-muted-foreground'>No tracks yet.</p>
          <Button
            size='sm'
            variant='ghost'
            className='mt-2'
            onClick={() => setShowAddForm(true)}>
            Add your first track
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}>
          <SortableContext
            items={localTracks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}>
            <div className='space-y-1'>
              {localTracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  onEdit={setEditingTrack}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <EditTrackDialog
        track={editingTrack}
        playlistId={id}
        onClose={() => setEditingTrack(null)}
      />
    </div>
  )
}
