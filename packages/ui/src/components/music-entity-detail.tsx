import { Badge } from './badge'
import { Card, CardContent } from './card'
import type { MusicEntityArtistsPanelProps } from './music-entity-artists-panel'
import type { MusicEntityAuditProps } from './music-entity-audit'
import { MusicEntityAudit } from './music-entity-audit'
import type { MusicEntityLinksPanelProps } from './music-entity-links-panel'
import type {
  MusicEntityMetadataFormProps,
  MusicEntityType
} from './music-entity-metadata-form'
import { Skeleton } from './skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

export interface MusicEntityDetailProps {
  entityType: MusicEntityType
  name: string
  imageUrl?: string | null
  publishedAt?: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
  createdBy?: MusicEntityAuditProps['createdBy']
  metadataSlot: React.ReactNode
  linksSlot: React.ReactNode
  relationshipsSlot?: React.ReactNode
  actionsSlot?: React.ReactNode
}

const TYPE_LABELS: Record<MusicEntityType, string> = {
  artist: 'Artist',
  album: 'Album',
  track: 'Track',
  playlist: 'Playlist'
}

export function MusicEntityDetail({
  entityType,
  name,
  imageUrl,
  publishedAt,
  createdAt,
  updatedAt,
  createdBy,
  metadataSlot,
  linksSlot,
  relationshipsSlot,
  actionsSlot
}: MusicEntityDetailProps) {
  const isPublished = publishedAt != null && new Date(publishedAt) <= new Date()

  return (
    <div className='space-y-6'>
      <Card>
        <CardContent className='flex gap-5 pt-6'>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className='h-24 w-24 shrink-0 rounded-md object-cover'
            />
          ) : (
            <div className='flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-muted text-3xl text-muted-foreground'>
              {entityType === 'artist'
                ? '🎤'
                : entityType === 'album'
                  ? '💿'
                  : entityType === 'track'
                    ? '🎵'
                    : '📋'}
            </div>
          )}
          <div className='flex min-w-0 flex-1 flex-col justify-center gap-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='outline'>{TYPE_LABELS[entityType]}</Badge>
              <Badge variant={isPublished ? 'default' : 'secondary'}>
                {isPublished ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <h1 className='truncate text-2xl font-bold'>{name}</h1>
            {actionsSlot && <div className='flex gap-2'>{actionsSlot}</div>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue='metadata'>
        <TabsList>
          <TabsTrigger value='metadata'>Metadata</TabsTrigger>
          <TabsTrigger value='links'>Links</TabsTrigger>
          {relationshipsSlot && (
            <TabsTrigger value='relationships'>Relationships</TabsTrigger>
          )}
          <TabsTrigger value='audit'>Audit</TabsTrigger>
        </TabsList>

        <TabsContent value='metadata' className='mt-4'>
          {metadataSlot}
        </TabsContent>

        <TabsContent value='links' className='mt-4'>
          {linksSlot}
        </TabsContent>

        {relationshipsSlot && (
          <TabsContent value='relationships' className='mt-4'>
            {relationshipsSlot}
          </TabsContent>
        )}

        <TabsContent value='audit' className='mt-4'>
          <MusicEntityAudit
            createdAt={createdAt}
            updatedAt={updatedAt}
            createdBy={createdBy}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function MusicEntityDetailSkeleton() {
  return (
    <div className='space-y-6'>
      <Card>
        <CardContent className='flex gap-5 pt-6'>
          <Skeleton className='h-24 w-24 shrink-0 rounded-md' />
          <div className='flex flex-1 flex-col gap-3'>
            <Skeleton className='h-5 w-24' />
            <Skeleton className='h-7 w-48' />
          </div>
        </CardContent>
      </Card>
      <Skeleton className='h-9 w-64' />
      <Skeleton className='h-64 w-full' />
    </div>
  )
}

export type {
  MusicEntityArtistsPanelProps,
  MusicEntityLinksPanelProps,
  MusicEntityMetadataFormProps,
  MusicEntityType
}
