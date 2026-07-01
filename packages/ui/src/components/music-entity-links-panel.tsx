import { useState } from 'react'
import { Badge } from './badge'
import { Button } from './button'
import { Card, CardContent, CardHeader } from './card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import { Input } from './input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

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

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  verified: 'default',
  pending_review: 'secondary',
  rejected: 'destructive'
}

export interface MusicEntityLinksPanelProps {
  links: MusicEntityLink[]
  onAdd?: (platform: MusicPlatform, url: string) => void
  onEdit?: (linkId: string, platform: MusicPlatform, url: string) => void
  onUpdateStatus?: (linkId: string, status: LinkStatus) => void
  onDelete?: (linkId: string) => void
  readOnly?: boolean
  embedded?: boolean
}

function toMusicPlatform(value: string): MusicPlatform {
  const match = PLATFORMS.find((platform) => platform === value)
  return match ?? 'other'
}

export function MusicEntityLinksPanel({
  links,
  onAdd,
  onEdit,
  onUpdateStatus,
  onDelete,
  readOnly = false,
  embedded = false
}: MusicEntityLinksPanelProps) {
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | null>(null)
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null)
  const [draftPlatform, setDraftPlatform] = useState<MusicPlatform>('spotify')
  const [draftUrl, setDraftUrl] = useState('')

  const pendingLinks = links.filter((link) => link.status === 'pending_review')

  function closeDialog() {
    setDialogMode(null)
    setActiveLinkId(null)
    setDraftPlatform('spotify')
    setDraftUrl('')
  }

  function openAddDialog() {
    setDialogMode('add')
    setDraftPlatform('spotify')
    setDraftUrl('')
  }

  function openEditDialog(link: MusicEntityLink) {
    setDialogMode('edit')
    setActiveLinkId(link.id)
    setDraftPlatform(toMusicPlatform(link.platform))
    setDraftUrl(link.url)
  }

  function handleSave() {
    if (!draftUrl.trim()) return
    if (dialogMode === 'add') {
      onAdd?.(draftPlatform, draftUrl.trim())
      closeDialog()
      return
    }
    if (dialogMode === 'edit' && activeLinkId) {
      onEdit?.(activeLinkId, draftPlatform, draftUrl.trim())
      closeDialog()
    }
  }

  function verifyAllPending() {
    for (const link of pendingLinks) {
      onUpdateStatus?.(link.id, 'verified')
    }
  }

  const header = (
    <div className='flex flex-row items-center justify-between gap-3'>
      <div className='flex items-center gap-2'>
        <span className='text-sm font-medium'>Streaming links</span>
        {pendingLinks.length > 0 && (
          <Badge variant='secondary' className='rounded-sm'>
            {pendingLinks.length} to verify
          </Badge>
        )}
      </div>
      <div className='flex items-center gap-1'>
        {!readOnly && pendingLinks.length > 0 && (
          <Button size='sm' variant='outline' className='rounded-sm' onClick={verifyAllPending}>
            Verify all
          </Button>
        )}
        {!readOnly && (
          <Button size='sm' variant='ghost' className='rounded-sm' onClick={openAddDialog}>
            Add link
          </Button>
        )}
      </div>
    </div>
  )

  const list = (
    <>
      {links.length === 0 && (
        <p className='text-sm text-muted-foreground'>
          {readOnly ? 'No links yet.' : 'No links yet. Paste a URL above to auto-fetch them.'}
        </p>
      )}
      <div className='space-y-2'>
        {links.map((link) => (
          <div key={link.id} className='rounded-md border px-3 py-2 text-sm'>
            <div className='flex min-w-0 flex-col gap-2'>
              <div className='min-w-0 flex-1 space-y-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='font-medium capitalize'>{link.platform.replace(/_/g, ' ')}</span>
                  <Badge variant={STATUS_VARIANTS[link.status] ?? 'outline'} className='rounded-sm'>
                    {link.status.replace('_', ' ')}
                  </Badge>
                </div>
                <a
                  href={link.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='block min-w-0 truncate text-xs text-blue-500 hover:underline'>
                  {link.url}
                </a>
              </div>
              {!readOnly && (
                <div className='flex flex-wrap gap-1'>
                  <Button size='sm' variant='ghost' onClick={() => openEditDialog(link)}>
                    Edit
                  </Button>
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
            </div>
          </div>
        ))}
      </div>
    </>
  )

  const dialog = (
    <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {dialogMode === 'edit' ? 'Edit streaming link' : 'Add streaming link'}
          </DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <Select value={draftPlatform} onValueChange={(v) => setDraftPlatform(toMusicPlatform(v))}>
            <SelectTrigger>
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
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSave()
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant='ghost' onClick={closeDialog}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!draftUrl.trim()}>
            Save link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (embedded) {
    return (
      <div className='space-y-3'>
        {header}
        {list}
        {dialog}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className='space-y-0'>{header}</CardHeader>
      <CardContent className='space-y-4'>{list}</CardContent>
      {dialog}
    </Card>
  )
}
