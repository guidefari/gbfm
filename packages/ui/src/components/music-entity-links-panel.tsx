import { useState } from 'react'
import { Badge } from './badge'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Input } from './input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './select'

export type LinkStatus = 'pending_review' | 'verified' | 'rejected'

export type MusicPlatform =
  | 'spotify'
  | 'youtube'
  | 'youtube_music'
  | 'apple_music'
  | 'bandcamp'
  | 'soundcloud'
  | 'tidal'
  | 'deezer'
  | 'amazon_music'
  | 'discord'
  | 'website'
  | 'instagram'
  | 'twitter'
  | 'musicbrainz'
  | 'other'

export interface MusicEntityLink {
  id: string
  entityType: string
  entityId: string
  platform: string
  url: string
  status: string
  scrapedAt?: Date | string | null
  verifiedAt?: Date | string | null
  verifiedBy?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: Date | string
  updatedAt: Date | string
}

const PLATFORMS: MusicPlatform[] = [
  'spotify',
  'youtube',
  'youtube_music',
  'apple_music',
  'bandcamp',
  'soundcloud',
  'tidal',
  'deezer',
  'amazon_music',
  'discord',
  'website',
  'instagram',
  'twitter',
  'musicbrainz',
  'other'
]

const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  verified: 'default',
  pending_review: 'secondary',
  rejected: 'destructive'
}

export interface MusicEntityLinksPanelProps {
  links: MusicEntityLink[]
  onAdd?: (platform: MusicPlatform, url: string) => void
  onUpdateStatus?: (linkId: string, status: LinkStatus) => void
  onDelete?: (linkId: string) => void
  readOnly?: boolean
}

export function MusicEntityLinksPanel({
  links,
  onAdd,
  onUpdateStatus,
  onDelete,
  readOnly = false
}: MusicEntityLinksPanelProps) {
  const [platform, setPlatform] = useState<MusicPlatform>('spotify')
  const [url, setUrl] = useState('')

  function handleAdd() {
    if (!url.trim()) return
    onAdd?.(platform, url.trim())
    setUrl('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-sm font-medium'>Streaming links</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {links.length === 0 && (
          <p className='text-sm text-muted-foreground'>No links yet.</p>
        )}
        <ul className='space-y-2'>
          {links.map((link) => (
            <li
              key={link.id}
              className='flex items-center gap-3 rounded-md border px-3 py-2 text-sm'>
              <span className='w-28 shrink-0 capitalize text-muted-foreground'>
                {link.platform.replace(/_/g, ' ')}
              </span>
              <a
                href={link.url}
                target='_blank'
                rel='noopener noreferrer'
                className='min-w-0 flex-1 truncate text-blue-500 hover:underline'>
                {link.url}
              </a>
              <Badge variant={STATUS_VARIANTS[link.status] ?? 'outline'}>
                {link.status.replace('_', ' ')}
              </Badge>
              {!readOnly && (
                <div className='flex shrink-0 gap-1'>
                  {link.status !== 'verified' && (
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => onUpdateStatus?.(link.id, 'verified')}>
                      Verify
                    </Button>
                  )}
                  {link.status !== 'rejected' && (
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => onUpdateStatus?.(link.id, 'rejected')}>
                      Reject
                    </Button>
                  )}
                  <Button
                    size='sm'
                    variant='ghost'
                    className='text-destructive'
                    onClick={() => onDelete?.(link.id)}>
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {!readOnly && (
          <div className='flex gap-2'>
            <Select
              value={platform}
              onValueChange={(v) => setPlatform(v as MusicPlatform)}>
              <SelectTrigger className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder='https://...'
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className='flex-1'
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} variant='outline'>
              Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
