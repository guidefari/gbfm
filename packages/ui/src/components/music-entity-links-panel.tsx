import { Check, MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from './button'
import { Card, CardContent, CardHeader } from './card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './dropdown-menu'
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

const STATUS_DOTS: Record<string, string> = {
  verified: 'bg-gb-pastel-green-1',
  pending_review: 'bg-amber-400',
  rejected: 'bg-destructive'
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
    <div className='flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2'>
      <div className='flex items-baseline gap-2'>
        <span className='whitespace-nowrap text-xs font-medium tracking-wide text-muted-foreground'>
          Streaming links
        </span>
        {pendingLinks.length > 0 && (
          <span className='whitespace-nowrap text-xs text-muted-foreground/70'>
            {pendingLinks.length} to verify
          </span>
        )}
      </div>
      <div className='flex items-center gap-1'>
        {!readOnly && pendingLinks.length > 0 && (
          <Button
            size='sm'
            variant='outline'
            className='h-7 rounded-sm px-2 text-xs'
            onClick={verifyAllPending}>
            <Check className='mr-1 size-3' />
            Verify all
          </Button>
        )}
        {!readOnly && (
          <Button
            size='sm'
            variant='ghost'
            className='h-7 rounded-sm px-2 text-xs'
            onClick={openAddDialog}>
            <Plus className='mr-1 size-3' />
            Add
          </Button>
        )}
      </div>
    </div>
  )

  const list = (
    <>
      {links.length === 0 && (
        <p className='text-xs text-muted-foreground'>
          {readOnly ? 'No links yet.' : 'No links yet. Paste a URL above to auto-fetch them.'}
        </p>
      )}
      <div className='divide-y divide-border/50 rounded-md border'>
        {links.map((link) => (
          <div
            key={link.id}
            className='group flex items-center gap-2.5 px-2.5 py-2 text-sm first:rounded-t-md last:rounded-b-md hover:bg-muted/40'>
            <span
              className={`size-2 shrink-0 rounded-full ${STATUS_DOTS[link.status] ?? 'bg-muted-foreground/40'}`}
              title={link.status.replace('_', ' ')}
            />
            <a
              href={link.url}
              target='_blank'
              rel='noopener noreferrer'
              className='min-w-0 flex-1 truncate font-medium capitalize hover:underline'
              title={link.url}>
              {link.platform.replace(/_/g, ' ')}
            </a>
            {!readOnly && (
              <div className='flex shrink-0 items-center gap-1'>
                {link.status !== 'verified' && (
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-7 rounded-sm px-2 text-xs text-gb-pastel-green-1 opacity-0 focus-visible:opacity-100 group-hover:opacity-100'
                    onClick={() => onUpdateStatus?.(link.id, 'verified')}>
                    Verify
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size='icon'
                      variant='ghost'
                      className='size-7 rounded-sm text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100'>
                      <MoreHorizontal className='size-4' />
                      <span className='sr-only'>More actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='w-32'>
                    <DropdownMenuItem onClick={() => openEditDialog(link)}>Edit</DropdownMenuItem>
                    {link.status !== 'rejected' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus?.(link.id, 'rejected')}>
                        Reject
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className='text-destructive focus:text-destructive'
                      onClick={() => onDelete?.(link.id)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
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
