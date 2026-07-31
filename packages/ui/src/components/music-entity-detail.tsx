import type { MusicEntityArtistsPanelProps } from './music-entity-artists-panel'
import type { MusicEntityAuditProps } from './music-entity-audit'
import { MusicEntityAudit } from './music-entity-audit'
import type { MusicEntityLinksPanelProps } from './music-entity-links-panel'
import type { MusicEntityMetadataFormProps, MusicEntityType } from './music-entity-metadata-form'
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
  playlist: 'Playlist',
  label: 'Label'
}

const TYPE_GLYPHS: Record<MusicEntityType, string> = {
  artist: '🎤',
  album: '💿',
  track: '🎵',
  playlist: '📋',
  label: '🏷️'
}

function Separator() {
  return (
    <span aria-hidden className='text-border'>
      /
    </span>
  )
}

function formatDay(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
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
    <div className='space-y-8'>
      <header className='group/detail flex flex-col gap-6 border-b border-border/60 pb-8 sm:flex-row sm:items-end'>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className='aspect-square w-full shrink-0 rounded-sm object-cover sm:w-44 md:w-56'
          />
        ) : (
          <div className='flex aspect-square w-full shrink-0 items-center justify-center rounded-sm bg-card text-5xl text-muted-foreground sm:w-44 md:w-56'>
            {TYPE_GLYPHS[entityType]}
          </div>
        )}

        <div className='flex min-w-0 flex-1 flex-col gap-3'>
          <div className='flex flex-wrap items-center gap-x-2 text-[11px] tracking-[0.2em] text-muted-foreground'>
            <span>{TYPE_LABELS[entityType]}</span>
            <Separator />
            <span className={isPublished ? 'text-highlight' : undefined}>
              {isPublished ? 'Published' : 'Draft'}
            </span>
            {isPublished && publishedAt != null && (
              <>
                <Separator />
                <span className='font-mono'>{formatDay(publishedAt)}</span>
              </>
            )}
          </div>

          <h1 className='text-2xl md:text-3xl font-bold leading-[1.1] tracking-tight text-foreground transition-colors group-hover/detail:text-highlight'>
            {name}
          </h1>

          {actionsSlot && (
            <div className='flex flex-wrap items-center gap-2 pt-1'>{actionsSlot}</div>
          )}
        </div>
      </header>

      <Tabs defaultValue='metadata'>
        <TabsList>
          <TabsTrigger value='metadata'>Metadata</TabsTrigger>
          <TabsTrigger value='links'>Links</TabsTrigger>
          {relationshipsSlot && <TabsTrigger value='relationships'>Relationships</TabsTrigger>}
          <TabsTrigger value='audit'>Audit</TabsTrigger>
        </TabsList>

        <TabsContent value='metadata' className='mt-6'>
          {metadataSlot}
        </TabsContent>

        <TabsContent value='links' className='mt-6'>
          {linksSlot}
        </TabsContent>

        {relationshipsSlot && (
          <TabsContent value='relationships' className='mt-6'>
            {relationshipsSlot}
          </TabsContent>
        )}

        <TabsContent value='audit' className='mt-6'>
          <MusicEntityAudit createdAt={createdAt} updatedAt={updatedAt} createdBy={createdBy} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function MusicEntityDetailSkeleton() {
  return (
    <div className='space-y-8'>
      <div className='flex flex-col gap-6 border-b border-border/60 pb-8 sm:flex-row sm:items-end'>
        <Skeleton className='aspect-square w-full shrink-0 rounded-sm sm:w-44 md:w-56' />
        <div className='flex flex-1 flex-col gap-3'>
          <Skeleton className='h-3 w-40' />
          <Skeleton className='h-9 w-64' />
          <Skeleton className='h-8 w-24' />
        </div>
      </div>
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
