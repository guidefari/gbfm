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
  type MusicLabel,
  type MusicTrack,
  useAddAdminEntityLink,
  useAddArtistToAlbum,
  useAddArtistToTrack,
  useAdminAlbum,
  useAdminAlbums,
  useAdminArtist,
  useAdminArtists,
  useAdminLabel,
  useAdminLabels,
  useAdminEntityLinks,
  useAdminTrack,
  useAffiliateAlbumWithLabel,
  useAffiliateArtistWithLabel,
  useAlbumLabels,
  useArtistLabels,
  useDeleteAdminAlbum,
  useDeleteAdminArtist,
  useDeleteAdminLabel,
  useDeleteAdminEntityLink,
  useDeleteAdminTrack,
  useLabelAlbums,
  useLabelArtists,
  useRemoveArtistFromAlbum,
  useRemoveArtistFromTrack,
  useUnaffiliateAlbumFromLabel,
  useUnaffiliateArtistFromLabel,
  useUpdateAdminAlbum,
  useUpdateAdminArtist,
  useUpdateAdminLabel,
  useUpdateAdminEntityLinkStatus,
  useUpdateAdminTrack
} from '@/lib/http'
import { AffiliationPanel, type AffiliationOption } from './-AffiliationPanel'

interface Props {
  entityType: MusicEntityType
  id: string
}

export function MusicEntityDetailPage({ entityType, id }: Props) {
  if (entityType === 'artist') return <ArtistDetailPage id={id} />
  if (entityType === 'album') return <AlbumDetailPage id={id} />
  if (entityType === 'track') return <TrackDetailPage id={id} />
  if (entityType === 'label') return <LabelDetailPage id={id} />
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
    try {
      await del.mutateAsync(id)
      toast({ title: 'Artist deleted' })
      navigate({ to: '/dashboard/music' })
    } catch (e) {
      toast({
        title: 'Failed to delete artist',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive'
      })
    }
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
            const metadata = Object.fromEntries(
              Object.entries(d).map(([key, value]) => [
                key,
                value instanceof Date ? value.toISOString() : value
              ])
            )
            try {
              await update.mutateAsync({
                id,
                data: metadata
              })
              toast({ title: 'Artist saved' })
            } catch (e) {
              toast({
                title: 'Failed to save artist',
                description: e instanceof Error ? e.message : undefined,
                variant: 'destructive'
              })
            }
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
      relationshipsSlot={<ArtistLabelAffiliations artistId={id} />}
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
    navigate({ to: '/dashboard/music' })
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
            const metadata = Object.fromEntries(Object.entries(d))
            await update.mutateAsync({
              id,
              data: metadata
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
        <div className='space-y-6'>
          <MusicEntityArtistsPanel
            artists={artistJunctions}
            onAdd={(artistId, role) => addArtist.mutate({ albumId: id, artistId, role })}
            onRemove={(artistId) => removeArtist.mutate({ albumId: id, artistId })}
          />
          <AlbumLabelAffiliations albumId={id} />
        </div>
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
    navigate({ to: '/dashboard/music' })
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
            const metadata = Object.fromEntries(Object.entries(d))
            await update.mutateAsync({
              id,
              data: metadata
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

function LabelDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useAdminLabel(id)
  const update = useUpdateAdminLabel()
  const del = useDeleteAdminLabel()
  const links = useAdminEntityLinks('label', id)
  const addLink = useAddAdminEntityLink()
  const updateLinkStatus = useUpdateAdminEntityLinkStatus()
  const deleteLink = useDeleteAdminEntityLink()

  if (isLoading) return <MusicEntityDetailSkeleton />
  if (!data) return <NotFound />

  async function handleDelete() {
    if (!confirm(`Delete label "${data?.name}"? This cannot be undone.`)) return
    try {
      await del.mutateAsync(id)
      toast({ title: 'Label deleted' })
      navigate({ to: '/dashboard/music' })
    } catch (error) {
      toast({
        title: 'Failed to delete label',
        description:
          error instanceof Error
            ? error.message
            : 'Labels with existing releases cannot be deleted.',
        variant: 'destructive'
      })
    }
  }

  return (
    <MusicEntityDetail
      entityType='label'
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
          entityType='label'
          initialData={toLabelMetadata(data)}
          isSaving={update.isPending}
          onSubmit={async (metadata) => {
            const data = Object.fromEntries(
              Object.entries(metadata).map(([key, value]) => [
                key,
                value instanceof Date ? value.toISOString() : value
              ])
            )
            try {
              await update.mutateAsync({ id, data })
              toast({ title: 'Label saved' })
            } catch (error) {
              toast({
                title: 'Failed to save label',
                description: error instanceof Error ? error.message : undefined,
                variant: 'destructive'
              })
            }
          }}
        />
      }
      linksSlot={
        <LinksPanel
          links={links.data ?? []}
          entityType='label'
          entityId={id}
          addLink={addLink}
          updateLinkStatus={updateLinkStatus}
          deleteLink={deleteLink}
        />
      }
      relationshipsSlot={<LabelAffiliations labelId={id} />}
    />
  )
}

const toArtistAffiliationOption = (artist: MusicArtist): AffiliationOption => ({
  id: artist.id,
  name: artist.name,
  publishedAt: artist.publishedAt,
  detail: artist.genres?.join(', ') || artist.slug
})

const toAlbumAffiliationOption = (album: MusicAlbum): AffiliationOption => ({
  id: album.id,
  name: album.title,
  publishedAt: album.publishedAt,
  detail: album.artistNames?.join(', ') || album.albumType || album.slug
})

const toLabelAffiliationOption = (label: MusicLabel): AffiliationOption => ({
  id: label.id,
  name: label.name,
  publishedAt: label.publishedAt,
  detail: label.slug
})

function LabelAffiliations({ labelId }: { labelId: string }) {
  const artists = useLabelArtists(labelId)
  const albums = useLabelAlbums(labelId)
  const artistCandidates = useAdminArtists()
  const albumCandidates = useAdminAlbums()
  const affiliateArtist = useAffiliateArtistWithLabel()
  const unaffiliateArtist = useUnaffiliateArtistFromLabel()
  const affiliateAlbum = useAffiliateAlbumWithLabel()
  const unaffiliateAlbum = useUnaffiliateAlbumFromLabel()

  return (
    <div className='space-y-6'>
      <AffiliationPanel
        title='Roster artists'
        description='Artists factually affiliated with this label.'
        items={(artists.data ?? []).map(toArtistAffiliationOption)}
        candidates={(artistCandidates.data ?? []).map(toArtistAffiliationOption)}
        isLoading={artists.isLoading || artistCandidates.isLoading}
        error={artists.error ?? artistCandidates.error}
        isMutating={affiliateArtist.isPending || unaffiliateArtist.isPending}
        onAdd={async (artistId) => {
          await affiliateArtist.mutateAsync({ labelId, artistId })
          toast({ title: 'Artist affiliated with label' })
        }}
        onRemove={async (artistId) => {
          await unaffiliateArtist.mutateAsync({ labelId, artistId })
          toast({ title: 'Artist affiliation removed' })
        }}
      />
      <AffiliationPanel
        title='Catalog albums'
        description='Albums factually issued by this label.'
        items={(albums.data ?? []).map(toAlbumAffiliationOption)}
        candidates={(albumCandidates.data ?? []).map(toAlbumAffiliationOption)}
        isLoading={albums.isLoading || albumCandidates.isLoading}
        error={albums.error ?? albumCandidates.error}
        isMutating={affiliateAlbum.isPending || unaffiliateAlbum.isPending}
        onAdd={async (albumId) => {
          await affiliateAlbum.mutateAsync({ labelId, albumId })
          toast({ title: 'Album affiliated with label' })
        }}
        onRemove={async (albumId) => {
          await unaffiliateAlbum.mutateAsync({ labelId, albumId })
          toast({ title: 'Album affiliation removed' })
        }}
      />
    </div>
  )
}

function ArtistLabelAffiliations({ artistId }: { artistId: string }) {
  const labels = useArtistLabels(artistId)
  const candidates = useAdminLabels()
  const affiliate = useAffiliateArtistWithLabel()
  const unaffiliate = useUnaffiliateArtistFromLabel()

  return (
    <AffiliationPanel
      title='Labels'
      description='Labels whose roster includes this artist.'
      items={(labels.data ?? []).map(toLabelAffiliationOption)}
      candidates={(candidates.data ?? []).map(toLabelAffiliationOption)}
      isLoading={labels.isLoading || candidates.isLoading}
      error={labels.error ?? candidates.error}
      isMutating={affiliate.isPending || unaffiliate.isPending}
      onAdd={async (labelId) => {
        await affiliate.mutateAsync({ labelId, artistId })
        toast({ title: 'Label affiliation added' })
      }}
      onRemove={async (labelId) => {
        await unaffiliate.mutateAsync({ labelId, artistId })
        toast({ title: 'Label affiliation removed' })
      }}
    />
  )
}

function AlbumLabelAffiliations({ albumId }: { albumId: string }) {
  const labels = useAlbumLabels(albumId)
  const candidates = useAdminLabels()
  const affiliate = useAffiliateAlbumWithLabel()
  const unaffiliate = useUnaffiliateAlbumFromLabel()

  return (
    <AffiliationPanel
      title='Labels'
      description='Labels that issued this album.'
      items={(labels.data ?? []).map(toLabelAffiliationOption)}
      candidates={(candidates.data ?? []).map(toLabelAffiliationOption)}
      isLoading={labels.isLoading || candidates.isLoading}
      error={labels.error ?? candidates.error}
      isMutating={affiliate.isPending || unaffiliate.isPending}
      onAdd={async (labelId) => {
        await affiliate.mutateAsync({ labelId, albumId })
        toast({ title: 'Label affiliation added' })
      }}
      onRemove={async (labelId) => {
        await unaffiliate.mutateAsync({ labelId, albumId })
        toast({ title: 'Label affiliation removed' })
      }}
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

function toLabelMetadata(label: MusicLabel) {
  return {
    name: label.name,
    description: label.description,
    imageUrl: label.imageUrl,
    bannerImageUrl: label.bannerImageUrl,
    slug: label.slug,
    content: label.content,
    tags: label.tags,
    genres: label.genres,
    publishedAt: label.publishedAt ? new Date(label.publishedAt) : null
  }
}
