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
  TabsTrigger
} from '@gbfm/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import {
  type MusicAlbum,
  type MusicArtist,
  type MusicTrack,
  useAdminAlbums,
  useAdminArtists,
  useAdminTracks
} from '@/lib/http'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'

export const Route = createFileRoute('/admin/music')({
  component: AdminMusicPage
})

function AdminMusicPage() {
  return (
    <AdminAccessGuard>
      <div className='flex flex-col h-[calc(100vh-8rem)]'>
        <header className='flex items-center justify-between gap-4 px-6 py-4 border-b shrink-0'>
          <div>
            <h1 className='text-xl font-bold'>Music catalog</h1>
            <p className='text-xs text-muted-foreground'>
              Browse and manage artists, albums, and tracks.
            </p>
          </div>
          <Button asChild variant='outline' size='sm'>
            <Link to='/admin'>
              <ArrowLeft className='w-4 h-4 mr-2' />
              Back to admin
            </Link>
          </Button>
        </header>
        <div className='flex-1 min-h-0 overflow-auto p-6'>
          <Tabs defaultValue='artists'>
            <TabsList>
              <TabsTrigger value='artists'>Artists</TabsTrigger>
              <TabsTrigger value='albums'>Albums</TabsTrigger>
              <TabsTrigger value='tracks'>Tracks</TabsTrigger>
            </TabsList>
            <TabsContent value='artists' className='mt-4'>
              <ArtistsTab />
            </TabsContent>
            <TabsContent value='albums' className='mt-4'>
              <AlbumsTab />
            </TabsContent>
            <TabsContent value='tracks' className='mt-4'>
              <TracksTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminAccessGuard>
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

function EntityList({
  isLoading,
  children
}: {
  isLoading: boolean
  children: React.ReactNode
}) {
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
        <CardTitle className='text-sm font-medium text-muted-foreground'>
          Entities
        </CardTitle>
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
        <img
          src={artist.imageUrl}
          alt=''
          className='h-9 w-9 rounded-sm object-cover shrink-0'
        />
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
