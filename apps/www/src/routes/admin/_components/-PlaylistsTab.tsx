import { Button, Input, Label, toast } from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetcher, VPS_BASE_URL } from '@/lib/http'
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
    <div className='flex h-full'>
      <aside
        className={`flex-col w-full md:w-80 border-r shrink-0 md:flex ${
          showSidebar ? 'flex' : 'hidden'
        }`}>
        <SpotifyConnectionCard />

        <div className='mx-3 mt-3 overflow-hidden rounded-md border'>
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
            <form
              onSubmit={handleSubmit}
              className='px-4 pb-4 space-y-2 border-t'>
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

        <div className='flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]'>
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
                <li key={p.id} className='group relative'>
                  <button
                    type='button'
                    onClick={() => setSelectedId(p.id)}
                    className={`flex items-center w-full gap-3 px-4 py-2 pr-10 text-left border-l-2 transition-colors ${
                      active
                        ? 'bg-muted text-foreground border-primary'
                        : 'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'
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
                  <Link
                    to='/admin/music/$entityType/$id'
                    params={{ entityType: 'playlist', id: p.id }}
                    aria-label='Edit playlist metadata'
                    className='absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground'>
                    <Pencil className='w-3.5 h-3.5' />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>

      <main
        className={`flex-1 min-w-0 ${showEditor ? 'flex' : 'hidden md:flex'} flex-col`}>
        {selected ? (
          <>
            <div className='flex items-center gap-2 px-4 py-2 border-b md:hidden shrink-0'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => setSelectedId(null)}>
                <ArrowLeft className='w-4 h-4 mr-2' />
                Playlists
              </Button>
              <span className='flex-1 text-sm font-medium truncate'>
                {selected.title}
              </span>
              <Button
                asChild
                variant='ghost'
                size='sm'
                aria-label='Edit playlist'>
                <Link
                  to='/admin/music/$entityType/$id'
                  params={{ entityType: 'playlist', id: selected.id }}>
                  <Pencil className='w-4 h-4' />
                </Link>
              </Button>
            </div>
            <div className='flex-1 min-h-0 overflow-y-auto lg:overflow-hidden [&::-webkit-scrollbar]:hidden [scrollbar-width:none]'>
              <div className='p-4 md:p-6 lg:h-full'>
                <PlaylistEditor key={selected.id} playlist={selected} />
              </div>
            </div>
          </>
        ) : (
          <div className='items-center justify-center hidden h-full text-sm md:flex text-muted-foreground'>
            Select a playlist to edit.
          </div>
        )}
      </main>
    </div>
  )
}
