import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/components/ui/use-toast'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
import { PlaylistEditor, type PlaylistSummary } from './-PlaylistEditor'

interface ImportResult {
  playlist: PlaylistSummary
  trackCount: number
  createdTrackCount: number
  reusedTrackCount: number
}

export function PlaylistsTab() {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const playlistsQuery = useQuery({
    queryKey: ['playlists'],
    queryFn: async () =>
      fetcher<PlaylistSummary[]>(`${VPS_BASE_URL}/music/playlists`)
  })

  useEffect(() => {
    if (selectedId) return
    const first = playlistsQuery.data?.[0]
    if (first) setSelectedId(first.id)
  }, [playlistsQuery.data, selectedId])

  const importMutation = useMutation({
    mutationFn: async (playlistUrl: string) =>
      fetcher<ImportResult>(`${VPS_BASE_URL}/music/playlists/import/spotify`, {
        method: 'POST',
        body: JSON.stringify({ url: playlistUrl })
      }),
    onSuccess: (data) => {
      setUrl('')
      setImportOpen(false)
      setSelectedId(data.playlist.id)
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      queryClient.invalidateQueries({
        queryKey: ['playlist-tracks', data.playlist.id]
      })
      toast({
        title: 'Playlist imported',
        description: `${data.trackCount} tracks (${data.createdTrackCount} new, ${data.reusedTrackCount} reused)`
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    importMutation.mutate(trimmed)
  }

  const isPending = importMutation.isPending
  const playlists = playlistsQuery.data ?? []
  const selected = playlists.find((p) => p.id === selectedId) ?? null

  return (
    <div className='flex h-full'>
      <aside className='flex flex-col w-80 border-r shrink-0'>
        <div className='border-b'>
          <button
            type='button'
            onClick={() => setImportOpen((v) => !v)}
            className='flex items-center justify-between w-full gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted/50'>
            <span className='flex items-center gap-2'>
              <Plus className='w-4 h-4' />
              Import Spotify playlist
            </span>
            {importOpen ? (
              <ChevronDown className='w-4 h-4' />
            ) : (
              <ChevronRight className='w-4 h-4' />
            )}
          </button>
          {importOpen && (
            <form onSubmit={handleSubmit} className='px-4 pb-4 space-y-2'>
              <p className='text-xs text-muted-foreground'>
                Tracks dedupe by Spotify URL. Re-import updates order.
              </p>
              <div className='space-y-1'>
                <Label htmlFor='spotify-playlist-url' className='text-xs'>
                  Playlist URL
                </Label>
                <Input
                  id='spotify-playlist-url'
                  type='url'
                  placeholder='https://open.spotify.com/playlist/...'
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>
              <Button
                type='submit'
                size='sm'
                className='w-full'
                disabled={isPending || !url.trim()}>
                {isPending ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Importing
                  </>
                ) : (
                  'Import'
                )}
              </Button>
            </form>
          )}
        </div>

        <div className='px-4 py-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground'>
          Playlists {playlists.length > 0 && `(${playlists.length})`}
        </div>

        <ScrollArea className='flex-1'>
          {playlistsQuery.isLoading && (
            <div className='px-4 py-2 text-sm text-muted-foreground'>
              Loading…
            </div>
          )}
          {playlistsQuery.error && (
            <div className='px-4 py-2 text-sm text-destructive'>
              Failed to load
            </div>
          )}
          {!playlistsQuery.isLoading && playlists.length === 0 && (
            <div className='px-4 py-2 text-sm text-muted-foreground'>
              No playlists yet.
            </div>
          )}
          <ul className='py-1'>
            {playlists.map((p) => {
              const active = p.id === selectedId
              return (
                <li key={p.id}>
                  <button
                    type='button'
                    onClick={() => setSelectedId(p.id)}
                    className={`flex items-center w-full gap-3 px-4 py-2 text-left transition-colors ${
                      active
                        ? 'bg-muted text-foreground'
                        : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}>
                    {p.coverImageUrl ? (
                      <img
                        src={p.coverImageUrl}
                        alt=''
                        className='object-cover w-10 h-10 rounded shrink-0'
                      />
                    ) : (
                      <div className='w-10 h-10 rounded bg-muted shrink-0' />
                    )}
                    <div className='min-w-0'>
                      <div className='text-sm font-medium truncate'>
                        {p.title}
                      </div>
                      <div className='text-xs truncate text-muted-foreground'>
                        {p.slug}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      </aside>

      <main className='flex-1 min-w-0'>
        {selected ? (
          <ScrollArea className='h-full'>
            <div className='p-6'>
              <PlaylistEditor key={selected.id} playlist={selected} />
            </div>
          </ScrollArea>
        ) : (
          <div className='flex items-center justify-center h-full text-sm text-muted-foreground'>
            Select a playlist to edit.
          </div>
        )}
      </main>
    </div>
  )
}
