import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

  const playlistsQuery = useQuery({
    queryKey: ['playlists'],
    queryFn: async () =>
      fetcher<PlaylistSummary[]>(`${VPS_BASE_URL}/music/playlists`)
  })

  const importMutation = useMutation({
    mutationFn: async (playlistUrl: string) =>
      fetcher<ImportResult>(`${VPS_BASE_URL}/music/playlists/import/spotify`, {
        method: 'POST',
        body: JSON.stringify({ url: playlistUrl })
      }),
    onSuccess: (data) => {
      setUrl('')
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

  return (
    <div className='space-y-8'>
      <section className='space-y-4'>
        <div>
          <h3 className='text-lg font-semibold'>Import Spotify playlist</h3>
          <p className='mt-1 text-sm text-muted-foreground'>
            Paste a Spotify playlist URL. Tracks are deduplicated by Spotify
            URL, so re-importing updates the order without creating duplicates.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-3 max-w-2xl'>
          <div className='space-y-1'>
            <Label htmlFor='spotify-playlist-url'>Spotify playlist URL</Label>
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
          <Button type='submit' disabled={isPending || !url.trim()}>
            {isPending ? (
              <>
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                Importing
              </>
            ) : (
              'Import playlist'
            )}
          </Button>
        </form>
      </section>

      <section className='space-y-3'>
        <h3 className='text-lg font-semibold'>Playlists</h3>
        {playlistsQuery.isLoading && (
          <div className='text-sm text-muted-foreground'>Loading…</div>
        )}
        {playlistsQuery.error && (
          <div className='text-sm text-destructive'>
            Failed to load playlists
          </div>
        )}
        {playlistsQuery.data && playlistsQuery.data.length === 0 && (
          <div className='text-sm text-muted-foreground'>
            No playlists yet. Import one above.
          </div>
        )}
        {playlistsQuery.data && playlistsQuery.data.length > 0 && (
          <Accordion type='multiple' className='w-full'>
            {playlistsQuery.data.map((p) => (
              <AccordionItem key={p.id} value={p.id}>
                <AccordionTrigger>
                  <div className='flex items-center gap-3'>
                    {p.coverImageUrl ? (
                      <img
                        src={p.coverImageUrl}
                        alt=''
                        className='w-10 h-10 rounded object-cover'
                      />
                    ) : (
                      <div className='w-10 h-10 rounded bg-muted' />
                    )}
                    <div className='text-left'>
                      <div className='font-medium'>{p.title}</div>
                      <div className='text-xs text-muted-foreground'>
                        {p.slug}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <PlaylistEditor playlist={p} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </section>
    </div>
  )
}
