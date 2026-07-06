import { Button, Input, Label, toast } from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CoverThumb } from '@/components/CoverThumb'
import { apiUrl, fetcher } from '@/lib/http'
import { PlaylistEditor, type PlaylistSummary } from './-PlaylistEditor'
import { SpotifyConnectionCard } from './-SpotifyConnectionCard'

interface ImportResult {
  status: 'Queued'
}

export function PlaylistsTab() {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const playlistsQuery = useQuery({
    queryKey: ['playlists'],
    queryFn: async () => fetcher<PlaylistSummary[]>(apiUrl('/music/playlists'))
  })

  useEffect(() => {
    if (selectedId) return
    const first = playlistsQuery.data?.[0]
    if (first) setSelectedId(first.id)
  }, [playlistsQuery.data, selectedId])

  const importMutation = useMutation({
    mutationFn: async (playlistUrl: string) =>
      fetcher<ImportResult>(apiUrl('/music/playlists/import/spotify'), {
        method: 'POST',
        body: JSON.stringify({ url: playlistUrl })
      }),
    onSuccess: () => {
      setUrl('')
      setImportOpen(false)
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      toast({
        title: 'Import queued',
        description: 'The playlist import is running in the background.'
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

  const showSidebar = !selected
  const showEditor = Boolean(selected)

  return (
    <div className='flex h-[calc(100dvh-12rem)] min-h-[32rem] border-y lg:border'>
      <aside
        className={`flex w-full flex-col border-r md:w-72 lg:w-80 ${showSidebar ? 'flex' : 'hidden md:flex'}`}>
        <SpotifyConnectionCard />

        <div className='mx-3 mt-3 overflow-hidden rounded-sm border'>
          <button
            type='button'
            onClick={() => setImportOpen((v) => !v)}
            className='flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/40'>
            <span className='flex items-center gap-2'>
              <Plus className='h-4 w-4' />
              Import Spotify playlist
            </span>
            {importOpen ? (
              <ChevronDown className='h-4 w-4' />
            ) : (
              <ChevronRight className='h-4 w-4' />
            )}
          </button>
          {importOpen && (
            <form onSubmit={handleSubmit} className='space-y-2 border-t px-4 pb-4 pt-3'>
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
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Importing
                  </>
                ) : (
                  'Import'
                )}
              </Button>
            </form>
          )}
        </div>

        <div className='px-4 pb-2 pt-4'>
          <div className='text-xs font-semibold tracking-[0.18em] text-muted-foreground'>
            Playlists {playlists.length > 0 && `(${playlists.length})`}
          </div>
        </div>

        <div className='flex-1 overflow-y-auto px-3 pb-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]'>
          {playlistsQuery.isLoading && (
            <div className='px-4 py-2 text-sm text-muted-foreground'>Loading…</div>
          )}
          {playlistsQuery.error && (
            <div className='px-4 py-2 text-sm text-destructive'>Failed to load</div>
          )}
          {!playlistsQuery.isLoading && playlists.length === 0 && (
            <div className='px-4 py-2 text-sm text-muted-foreground'>No playlists yet.</div>
          )}
          <ul className='overflow-hidden rounded-sm border'>
            {playlists.map((p) => {
              const active = p.id === selectedId
              return (
                <li key={p.id} className='group relative'>
                  <button
                    type='button'
                    onClick={() => setSelectedId(p.id)}
                    className={`flex w-full items-center gap-3 border-b px-4 py-3 pr-10 text-left transition-colors last:border-b-0 ${
                      active ? 'bg-muted/60 text-foreground' : 'text-foreground hover:bg-muted/30'
                    }`}>
                    <CoverThumb src={p.coverImageUrl} className='h-10 w-10 shrink-0 rounded-sm' />
                    <div className='min-w-0'>
                      <div className='truncate text-sm font-medium'>{p.title}</div>
                      <div className='truncate text-xs text-muted-foreground'>{p.slug}</div>
                    </div>
                  </button>
                  <Link
                    to='/admin/music-entity/$entityType/$id'
                    params={{ entityType: 'playlist', id: p.id }}
                    aria-label='Edit playlist metadata'
                    className='absolute right-2 top-1/2 rounded-sm p-1.5 text-muted-foreground opacity-0 transition-opacity -translate-y-1/2 hover:bg-muted hover:text-foreground group-hover:opacity-100'>
                    <Pencil className='h-3.5 w-3.5' />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>

      <main className={`min-w-0 flex-1 ${showEditor ? 'flex' : 'hidden md:flex'} flex-col`}>
        {selected ? (
          <>
            <div className='flex shrink-0 items-center gap-2 border-b px-4 py-2 md:hidden'>
              <Button type='button' variant='ghost' size='sm' onClick={() => setSelectedId(null)}>
                <ArrowLeft className='mr-2 h-4 w-4' />
                Playlists
              </Button>
              <span className='flex-1 truncate text-sm font-medium'>{selected.title}</span>
              <Button asChild variant='ghost' size='sm' aria-label='Edit playlist'>
                <Link
                  to='/admin/music-entity/$entityType/$id'
                  params={{ entityType: 'playlist', id: selected.id }}>
                  <Pencil className='h-4 w-4' />
                </Link>
              </Button>
            </div>
            <div className='flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]'>
              <PlaylistEditor key={selected.id} playlist={selected} />
            </div>
          </>
        ) : (
          <div className='hidden h-full items-center justify-center text-sm text-muted-foreground md:flex'>
            Select a playlist to edit.
          </div>
        )}
      </main>
    </div>
  )
}
