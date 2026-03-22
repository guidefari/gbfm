import { Link } from '@tanstack/react-router'
import { Globe, Lock, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { useCreatePlaylist, useDeletePlaylist, usePlaylists } from '@/lib/http'

function toSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function PlaylistsTab() {
  const { data: playlists, isPending } = usePlaylists()
  const { mutateAsync: createPlaylist, isPending: isCreating } =
    useCreatePlaylist()
  const { mutateAsync: deletePlaylist } = useDeletePlaylist()

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ title: '', isPublic: false })

  async function handleCreate() {
    if (!form.title.trim()) return
    try {
      await createPlaylist({
        title: form.title.trim(),
        slug: toSlug(form.title.trim()),
        isPublic: form.isPublic
      })
      setCreateOpen(false)
      setForm({ title: '', isPublic: false })
      toast({ title: 'Playlist created' })
    } catch {
      toast({ title: 'Failed to create playlist', variant: 'destructive' })
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      await deletePlaylist(id)
      toast({ title: 'Playlist deleted' })
    } catch {
      toast({ title: 'Failed to delete playlist', variant: 'destructive' })
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-medium'>Mix Prep Playlists</h3>
        <Button size='sm' onClick={() => setCreateOpen(true)}>
          <Plus className='mr-1 h-4 w-4' />
          New Playlist
        </Button>
      </div>

      {isPending && (
        <p className='text-sm text-muted-foreground'>Loading playlists…</p>
      )}

      {playlists && playlists.length === 0 && (
        <p className='text-sm text-muted-foreground'>
          No playlists yet. Create one to start planning your next mix.
        </p>
      )}

      <div className='space-y-2'>
        {playlists?.map((playlist) => (
          <div
            key={playlist.id}
            className='flex items-center justify-between rounded-md border border-border bg-card px-4 py-3'>
            <div className='flex items-center gap-3 min-w-0'>
              {playlist.isPublic ? (
                <Globe className='h-4 w-4 shrink-0 text-muted-foreground' />
              ) : (
                <Lock className='h-4 w-4 shrink-0 text-muted-foreground' />
              )}
              <div className='min-w-0'>
                <Link
                  to='/admin/playlists/$id'
                  params={{ id: playlist.id }}
                  className='truncate font-medium hover:underline'>
                  {playlist.title}
                </Link>
                {playlist.description && (
                  <p className='text-xs text-muted-foreground truncate'>
                    {playlist.description}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant='ghost'
              size='icon'
              className='shrink-0 text-muted-foreground hover:text-destructive'
              onClick={() => handleDelete(playlist.id, playlist.title)}>
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Playlist</DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-2'>
            <div className='space-y-2'>
              <Label htmlFor='playlist-title'>Title</Label>
              <Input
                id='playlist-title'
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder='Late Night Selections'
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className='flex items-center gap-2'>
              <Checkbox
                id='playlist-public'
                checked={form.isPublic}
                onCheckedChange={(v) =>
                  setForm((prev) => ({ ...prev, isPublic: Boolean(v) }))
                }
              />
              <Label htmlFor='playlist-public'>Public</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
