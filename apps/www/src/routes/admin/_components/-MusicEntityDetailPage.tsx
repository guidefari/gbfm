import { LINK_STATUS } from '@gbfm/core/status'
import {
  type ArtistJunction,
  Button,
  MusicEntityArtistsPanel,
  MusicEntityDetail,
  MusicEntityDetailSkeleton,
  type MusicEntityLink,
  MusicEntityLinksPanel,
  MusicEntityMetadataForm,
  type MusicEntityType,
  toast
} from '@gbfm/ui'
import { useNavigate } from '@tanstack/react-router'
import {
  type MusicAlbum,
  type MusicArtist,
  type MusicTrack,
  useAddAdminEntityLink,
  useAddArtistToAlbum,
  useAddArtistToTrack,
  useAdminAlbum,
  useAdminArtist,
  useAdminEntityLinks,
  useAdminTrack,
  useDeleteAdminAlbum,
  useDeleteAdminArtist,
  useDeleteAdminEntityLink,
  useDeleteAdminTrack,
  useRemoveArtistFromAlbum,
  useRemoveArtistFromTrack,
  useUpdateAdminAlbum,
  useUpdateAdminArtist,
  useUpdateAdminEntityLinkStatus,
  useUpdateAdminTrack
} from '@/lib/http'

interface Props {
  entityType: MusicEntityType
  id: string
}

export function MusicEntityDetailPage({ entityType, id }: Props) {
  if (entityType === 'artist') return <ArtistDetailPage id={id} />
  if (entityType === 'album') return <AlbumDetailPage id={id} />
  if (entityType === 'track') return <TrackDetailPage id={id} />
  return <p className='p-6 text-muted-foreground'>Unsupported entity type.</p>
}

function ArtistDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useAdminArtist(id)
  const update = useUpdateAdminArtist()
  const del = useDeleteAdminArtist()
  const links = useAdminEntityLinks('artist', id)
  const addLink = useAddAdminEntityLink()
  const updateLinkStatus = useUpdateAdminEntityLinkStatus()
  const deleteLink = useDeleteAdminEntityLink()

  if (isLoading) return <MusicEntityDetailSkeleton />
  if (!data) return <NotFound />

  async function handleDelete() {
    if (!confirm(`Delete artist "${data?.name}"? This cannot be undone.`)) return
    await del.mutateAsync(id)
    toast({ title: 'Artist deleted' })
    navigate({ to: '/admin/music' })
  }

  return (
    <MusicEntityDetail
      entityType='artist'
      name={data.name}
      imageUrl={data.imageUrl}
      publishedAt={data.publishedAt}
      createdAt={data.createdAt}
      updatedAt={data.updatedAt}
      actionsSlot={
        <Button size='sm' variant='destructive' onClick={handleDelete} disabled={del.isPending}>
          Delete
        </Button>
      }
      metadataSlot={
        <MusicEntityMetadataForm
          entityType='artist'
          initialData={toArtistMetadata(data)}
          isSaving={update.isPending}
          onSubmit={async (d) => {
            await update.mutateAsync({
              id,
              data: d as unknown as Record<string, unknown>
            })
            toast({ title: 'Artist saved' })
          }}
        />
      }
      linksSlot={
        <LinksPanel
          links={links.data ?? []}
          entityType='artist'
          entityId={id}
          addLink={addLink}
          updateLinkStatus={updateLinkStatus}
          deleteLink={deleteLink}
        />
      }
    />
  )
}

function AlbumDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useAdminAlbum(id)
  const update = useUpdateAdminAlbum()
  const del = useDeleteAdminAlbum()
  const links = useAdminEntityLinks('album', id)
  const addLink = useAddAdminEntityLink()
  const updateLinkStatus = useUpdateAdminEntityLinkStatus()
  const deleteLink = useDeleteAdminEntityLink()
  const addArtist = useAddArtistToAlbum()
  const removeArtist = useRemoveArtistFromAlbum()

  if (isLoading) return <MusicEntityDetailSkeleton />
  if (!data) return <NotFound />

  const artistJunctions: ArtistJunction[] = (data.artistNames ?? []).map((name, i) => ({
    artistId: `unknown-${i}`,
    artistName: name,
    displayOrder: i
  }))

  async function handleDelete() {
    if (!confirm(`Delete album "${data?.title}"? This cannot be undone.`)) return
    await del.mutateAsync(id)
    toast({ title: 'Album deleted' })
    navigate({ to: '/admin/music' })
  }

  return (
    <MusicEntityDetail
      entityType='album'
      name={data.title}
      imageUrl={data.coverImageUrl}
      publishedAt={data.publishedAt}
      createdAt={data.createdAt}
      updatedAt={data.updatedAt}
      actionsSlot={
        <Button size='sm' variant='destructive' onClick={handleDelete} disabled={del.isPending}>
          Delete
        </Button>
      }
      metadataSlot={
        <MusicEntityMetadataForm
          entityType='album'
          initialData={toAlbumMetadata(data)}
          isSaving={update.isPending}
          onSubmit={async (d) => {
            await update.mutateAsync({
              id,
              data: d as unknown as Record<string, unknown>
            })
            toast({ title: 'Album saved' })
          }}
        />
      }
      linksSlot={
        <LinksPanel
          links={links.data ?? []}
          entityType='album'
          entityId={id}
          addLink={addLink}
          updateLinkStatus={updateLinkStatus}
          deleteLink={deleteLink}
        />
      }
      relationshipsSlot={
        <MusicEntityArtistsPanel
          artists={artistJunctions}
          onAdd={(artistId, role) => addArtist.mutate({ albumId: id, artistId, role })}
          onRemove={(artistId) => removeArtist.mutate({ albumId: id, artistId })}
        />
      }
    />
  )
}

function TrackDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useAdminTrack(id)
  const update = useUpdateAdminTrack()
  const del = useDeleteAdminTrack()
  const links = useAdminEntityLinks('track', id)
  const addLink = useAddAdminEntityLink()
  const updateLinkStatus = useUpdateAdminEntityLinkStatus()
  const deleteLink = useDeleteAdminEntityLink()
  const addArtist = useAddArtistToTrack()
  const removeArtist = useRemoveArtistFromTrack()

  if (isLoading) return <MusicEntityDetailSkeleton />
  if (!data) return <NotFound />

  const artistJunctions: ArtistJunction[] = (data.artistNames ?? []).map((name, i) => ({
    artistId: `unknown-${i}`,
    artistName: name,
    displayOrder: i
  }))

  async function handleDelete() {
    if (!confirm(`Delete track "${data?.title}"? This cannot be undone.`)) return
    await del.mutateAsync(id)
    toast({ title: 'Track deleted' })
    navigate({ to: '/admin/music' })
  }

  return (
    <MusicEntityDetail
      entityType='track'
      name={data.title}
      imageUrl={data.coverImageUrl}
      publishedAt={data.publishedAt}
      createdAt={data.createdAt}
      updatedAt={data.updatedAt}
      actionsSlot={
        <Button size='sm' variant='destructive' onClick={handleDelete} disabled={del.isPending}>
          Delete
        </Button>
      }
      metadataSlot={
        <MusicEntityMetadataForm
          entityType='track'
          initialData={toTrackMetadata(data)}
          isSaving={update.isPending}
          onSubmit={async (d) => {
            await update.mutateAsync({
              id,
              data: d as unknown as Record<string, unknown>
            })
            toast({ title: 'Track saved' })
          }}
        />
      }
      linksSlot={
        <LinksPanel
          links={links.data ?? []}
          entityType='track'
          entityId={id}
          addLink={addLink}
          updateLinkStatus={updateLinkStatus}
          deleteLink={deleteLink}
        />
      }
      relationshipsSlot={
        <MusicEntityArtistsPanel
          artists={artistJunctions}
          onAdd={(artistId, role) => addArtist.mutate({ trackId: id, artistId, role })}
          onRemove={(artistId) => removeArtist.mutate({ trackId: id, artistId })}
        />
      }
    />
  )
}

interface LinksPanelProps {
  links: MusicEntityLink[]
  entityType: string
  entityId: string
  addLink: ReturnType<typeof useAddAdminEntityLink>
  updateLinkStatus: ReturnType<typeof useUpdateAdminEntityLinkStatus>
  deleteLink: ReturnType<typeof useDeleteAdminEntityLink>
}

function LinksPanel({
  links,
  entityType,
  entityId,
  addLink,
  updateLinkStatus,
  deleteLink
}: LinksPanelProps) {
  function handleEdit(linkId: string, platform: string, url: string) {
    const existingLink = links.find((link) => link.id === linkId)
    addLink.mutate(
      { entityType, entityId, platform, url, status: LINK_STATUS.VERIFIED },
      {
        onSuccess: () => {
          if (existingLink && existingLink.platform !== platform) {
            deleteLink.mutate({ entityType, entityId, linkId })
          }
        },
        onError: (e) =>
          toast({
            title: 'Failed to edit link',
            description: e.message,
            variant: 'destructive'
          })
      }
    )
  }

  return (
    <MusicEntityLinksPanel
      links={links}
      onAdd={(platform, url) =>
        addLink.mutate(
          { entityType, entityId, platform, url, status: LINK_STATUS.VERIFIED },
          {
            onError: (e) =>
              toast({
                title: 'Failed to add link',
                description: e.message,
                variant: 'destructive'
              })
          }
        )
      }
      onEdit={handleEdit}
      onUpdateStatus={(linkId, status) =>
        updateLinkStatus.mutate({ entityType, entityId, linkId, status })
      }
      onDelete={(linkId) => deleteLink.mutate({ entityType, entityId, linkId })}
    />
  )
}

function NotFound() {
  return <div className='p-8 text-center text-muted-foreground'>Entity not found.</div>
}

function toArtistMetadata(a: MusicArtist) {
  return {
    name: a.name,
    bio: a.bio,
    imageUrl: a.imageUrl,
    genres: a.genres,
    slug: a.slug,
    publishedAt: a.publishedAt ? new Date(a.publishedAt) : null
  }
}

function toAlbumMetadata(a: MusicAlbum) {
  return {
    title: a.title,
    artistNames: a.artistNames,
    releaseDate: a.releaseDate ? new Date(a.releaseDate) : null,
    coverImageUrl: a.coverImageUrl,
    genres: a.genres,
    albumType: a.albumType,
    slug: a.slug,
    publishedAt: a.publishedAt ? new Date(a.publishedAt) : null
  }
}

function toTrackMetadata(t: MusicTrack) {
  return {
    title: t.title,
    artistNames: t.artistNames,
    coverImageUrl: t.coverImageUrl,
    trackNumber: t.trackNumber,
    slug: t.slug,
    publishedAt: t.publishedAt ? new Date(t.publishedAt) : null
  }
}
