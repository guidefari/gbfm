import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@gbfm/ui'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import type { SocialLink, SocialLinkPlatform } from '@/lib/http'

export const SOCIAL_LINK_PLATFORM_OPTIONS: SocialLinkPlatform[] = [
  'bandcamp',
  'substack',
  'soundcloud',
  'instagram',
  'twitter',
  'tiktok'
]

export const SOCIAL_LINK_PLATFORM_LABELS = {
  bandcamp: 'Bandcamp',
  substack: 'Substack',
  soundcloud: 'SoundCloud',
  instagram: 'IG',
  twitter: 'Twitter',
  tiktok: 'TikTok'
} satisfies Record<SocialLinkPlatform, string>

export function SortableSocialLinkRow({
  link,
  onChange,
  onRemove
}: {
  link: SocialLink
  onChange: (next: SocialLink) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `${link.platform}-${link.position}-${link.url}`
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='grid grid-cols-[auto_180px_1fr_auto] items-start gap-2 rounded-sm border p-3'>
      <button
        type='button'
        className='mt-2 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing'
        aria-label='Reorder social link'
        {...attributes}
        {...listeners}>
        <GripVertical className='h-4 w-4' />
      </button>

      <Select
        value={link.platform}
        onValueChange={(value: SocialLinkPlatform) => onChange({ ...link, platform: value })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOCIAL_LINK_PLATFORM_OPTIONS.map((platform) => (
            <SelectItem key={platform} value={platform}>
              {SOCIAL_LINK_PLATFORM_LABELS[platform]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={link.url}
        onChange={(e) => onChange({ ...link, url: e.target.value })}
        placeholder='https://...'
      />

      <Button type='button' variant='ghost' size='sm' onClick={onRemove}>
        <X className='h-4 w-4' />
      </Button>
    </div>
  )
}
