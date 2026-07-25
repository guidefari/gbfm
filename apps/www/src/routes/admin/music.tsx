import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast
} from '@gbfm/ui'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  type MusicAlbum,
  type MusicArtist,
  type MusicLabel,
  type MusicTrack,
  useAdminAlbums,
  useAdminArtists,
  useAdminLabels,
  useAdminTracks
} from '@/lib/http'
import { useCreateAdminLabel } from '@/lib/http'
import { AdminPage } from './_components/-AdminLayout'
import { PlaylistsTab } from './_components/-PlaylistsTab'

export const Route = createFileRoute('/admin/music')({
  component: AdminMusicPage
})

function AdminMusicPage() {
  return (
    <AdminPage
      title='Music Catalog'
      description='Artists, albums, tracks, playlists, and record labels.'
      backToAdmin>
      <Card className='overflow-hidden'>
        <Tabs defaultValue='artists' className='flex min-h-0 flex-col'>
          <div className='flex items-center justify-between gap-4 border-b px-6 py-3'>
            <div className='text-sm text-muted-foreground'>
              Switch between music entity types without leaving the catalog route.
            </div>
            <div className='flex items-center gap-3'>
              <TabsList className='h-8 gap-0.5 bg-muted/60'>
                <TabsTrigger value='artists' className='h-6 px-3 text-xs'>
                  Artists
                </TabsTrigger>
                <TabsTrigger value='albums' className='h-6 px-3 text-xs'>
                  Albums
                </TabsTrigger>
                <TabsTrigger value='tracks' className='h-6 px-3 text-xs'>
                  Tracks
                </TabsTrigger>
                <TabsTrigger value='playlists' className='h-6 px-3 text-xs'>
                  Playlists
                </TabsTrigger>
                <TabsTrigger value='labels' className='h-6 px-3 text-xs'>
                  Labels
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          <TabsContent value='artists' className='mt-0 flex-1 overflow-auto p-6'>
            <ArtistsTab />
          </TabsContent>
          <TabsContent value='albums' className='mt-0 flex-1 overflow-auto p-6'>
            <AlbumsTab />
          </TabsContent>
          <TabsContent value='tracks' className='mt-0 flex-1 overflow-auto p-6'>
            <TracksTab />
          </TabsContent>
          <TabsContent value='playlists' className='mt-0 flex-1 min-h-0'>
            <PlaylistsTab />
          </TabsContent>
          <TabsContent value='labels' className='mt-0 flex-1 overflow-auto p-6'>
            <LabelsTab />
          </TabsContent>
        </Tabs>
      </Card>
    </AdminPage>
  )
}

function ArtistsTab() {
  const { data, isLoading } = useAdminArtists()
  return (
    <EntityList isLoading={isLoading}>
      {(data ?? []).map((a) => (
        <ArtistRow key={a.id} artist={a} />
      ))}
    </EntityList>
  )
}

function AlbumsTab() {
  const { data, isLoading } = useAdminAlbums()
  return (
    <EntityList isLoading={isLoading}>
      {(data ?? []).map((a) => (
        <AlbumRow key={a.id} album={a} />
      ))}
    </EntityList>
  )
}

function TracksTab() {
  const { data, isLoading } = useAdminTracks()
  return (
    <EntityList isLoading={isLoading}>
      {(data ?? []).map((t) => (
        <TrackRow key={t.id} track={t} />
      ))}
    </EntityList>
  )
}

function LabelsTab() {
  const navigate = useNavigate()
  const { data, isLoading } = useAdminLabels()
  const createLabel = useCreateAdminLabel()

  const handleCreate = async () => {
    try {
      const label = await createLabel.mutateAsync({
        name: 'Untitled label',
        slug: `untitled-label-${Date.now()}`,
        content: ''
      })
      navigate({
        to: '/admin/music-entity/$entityType/$id',
        params: { entityType: 'label', id: label.id }
      })
    } catch {
      toast({
        title: 'Unable to create label',
        description: 'Please try again. If the problem continues, refresh the page.',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button size='sm' onClick={handleCreate} disabled={createLabel.isPending}>
          {createLabel.isPending ? 'Creating...' : 'New label'}
        </Button>
      </div>
      <EntityList isLoading={isLoading}>
        {(data ?? []).map((label) => (
          <LabelRow key={label.id} label={label} />
        ))}
      </EntityList>
    </div>
  )
}

function EntityList({ isLoading, children }: { isLoading: boolean; children: React.ReactNode }) {
  if (isLoading) {
    return (
      <div className='space-y-2'>
        {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
          <Skeleton key={k} className='h-14 w-full rounded-md' />
        ))}
      </div>
    )
  }
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm font-medium text-muted-foreground'>Entities</CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        <ul className='divide-y'>{children}</ul>
      </CardContent>
    </Card>
  )
}

function ArtistRow({ artist }: { artist: MusicArtist }) {
  return (
    <li className='flex items-center gap-4 px-6 py-3 hover:bg-muted/40 transition-colors'>
      {artist.imageUrl && (
        <img src={artist.imageUrl} alt='' className='h-9 w-9 rounded-sm object-cover shrink-0' />
      )}
      <div className='flex-1 min-w-0'>
        <p className='font-medium truncate'>{artist.name}</p>
        <p className='text-xs text-muted-foreground font-mono'>{artist.slug}</p>
      </div>
      <div className='flex items-center gap-2 shrink-0'>
        {artist.publishedAt ? (
          <Badge variant='default' className='text-xs'>
            Published
          </Badge>
        ) : (
          <Badge variant='secondary' className='text-xs'>
            Draft
          </Badge>
        )}
        <Button asChild size='sm' variant='outline'>
          <Link
            to='/admin/music-entity/$entityType/$id'
            params={{ entityType: 'artist', id: artist.id }}>
            Edit
          </Link>
        </Button>
      </div>
    </li>
  )
}

function AlbumRow({ album }: { album: MusicAlbum }) {
  return (
    <li className='flex items-center gap-4 px-6 py-3 hover:bg-muted/40 transition-colors'>
      {album.coverImageUrl && (
        <img
          src={album.coverImageUrl}
          alt=''
          className='h-9 w-9 rounded-sm object-cover shrink-0'
        />
      )}
      <div className='flex-1 min-w-0'>
        <p className='font-medium truncate'>{album.title}</p>
        <p className='text-xs text-muted-foreground truncate'>
          {album.artistNames?.join(', ') ?? '—'}
        </p>
      </div>
      <div className='flex items-center gap-2 shrink-0'>
        {album.albumType && (
          <Badge variant='outline' className='text-xs'>
            {album.albumType}
          </Badge>
        )}
        {album.publishedAt ? (
          <Badge variant='default' className='text-xs'>
            Published
          </Badge>
        ) : (
          <Badge variant='secondary' className='text-xs'>
            Draft
          </Badge>
        )}
        <Button asChild size='sm' variant='outline'>
          <Link
            to='/admin/music-entity/$entityType/$id'
            params={{ entityType: 'album', id: album.id }}>
            Edit
          </Link>
        </Button>
      </div>
    </li>
  )
}

function TrackRow({ track }: { track: MusicTrack }) {
  return (
    <li className='flex items-center gap-4 px-6 py-3 hover:bg-muted/40 transition-colors'>
      {track.coverImageUrl && (
        <img
          src={track.coverImageUrl}
          alt=''
          className='h-9 w-9 rounded-sm object-cover shrink-0'
        />
      )}
      <div className='flex-1 min-w-0'>
        <p className='font-medium truncate'>{track.title}</p>
        <p className='text-xs text-muted-foreground truncate'>
          {track.artistNames?.join(', ') ?? '—'}
        </p>
      </div>
      <div className='flex items-center gap-2 shrink-0'>
        {track.publishedAt ? (
          <Badge variant='default' className='text-xs'>
            Published
          </Badge>
        ) : (
          <Badge variant='secondary' className='text-xs'>
            Draft
          </Badge>
        )}
        <Button asChild size='sm' variant='outline'>
          <Link
            to='/admin/music-entity/$entityType/$id'
            params={{ entityType: 'track', id: track.id }}>
            Edit
          </Link>
        </Button>
      </div>
    </li>
  )
}

function LabelRow({ label }: { label: MusicLabel }) {
  const isPublished = label.publishedAt !== null && new Date(label.publishedAt) <= new Date()

  return (
    <li className='flex items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/40'>
      {label.imageUrl && (
        <img src={label.imageUrl} alt='' className='h-9 w-9 shrink-0 rounded-sm object-cover' />
      )}
      <div className='min-w-0 flex-1'>
        <p className='truncate font-medium'>{label.name}</p>
        <p className='truncate font-mono text-xs text-muted-foreground'>{label.slug}</p>
      </div>
      <div className='flex shrink-0 items-center gap-2'>
        <Badge variant={isPublished ? 'default' : 'secondary'} className='text-xs'>
          {isPublished ? 'Published' : 'Draft'}
        </Badge>
        <Button asChild size='sm' variant='outline'>
          <Link
            to='/admin/music-entity/$entityType/$id'
            params={{ entityType: 'label', id: label.id }}>
            Edit
          </Link>
        </Button>
      </div>
    </li>
  )
}
