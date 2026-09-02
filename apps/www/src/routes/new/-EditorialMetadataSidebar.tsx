import { Badge, Button, Input, Label, TagsInput } from '@gbfm/ui'
import { ImageIcon, Plus, Upload, X } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { usePostTags } from '@/lib/http'
import { UserSearch } from '../dashboard/_components/-UserSearch'
import type { EditorialCreator, EditorialFormData } from './-editorial-types'

export function EditorialMetadataPanel({
  formData,
  artworkFile,
  artworkPreview,
  artworkUploadId,
  selectedCreators,
  onArtworkFileChange,
  onRemoveArtwork,
  onThumbnailUrlChange,
  onSlugChange,
  onAddTag,
  onRemoveTag,
  onCreatorChange
}: {
  formData: EditorialFormData
  artworkFile: File | null
  artworkPreview: string | null
  artworkUploadId: string
  selectedCreators: EditorialCreator[]
  onArtworkFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveArtwork: () => void
  onThumbnailUrlChange: (value: string) => void
  onSlugChange: (value: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onCreatorChange: (creators: EditorialCreator[]) => void
}) {
  const [open, setOpen] = useState(false)
  const artworkUrl = artworkPreview || formData.thumbnailUrl
  const { data: availableTags } = usePostTags()

  return (
    <section className='mt-6' aria-label='Editorial details'>
      <div className='flex min-h-9 flex-wrap items-center gap-2'>
        {selectedCreators.map((creator) => (
          <Badge key={creator.id} variant='secondary' className='h-8 gap-1.5 px-3 font-normal'>
            By {creator.name}
            <button
              type='button'
              aria-label={`Remove ${creator.name}`}
              onClick={() =>
                onCreatorChange(selectedCreators.filter((selected) => selected.id !== creator.id))
              }
              className='rounded-sm text-muted-foreground transition-colors hover:text-destructive'>
              <X className='size-3' />
            </button>
          </Badge>
        ))}
        {formData.tags.map((tag) => (
          <Badge key={tag} variant='outline' className='h-8 gap-1.5 px-3 font-normal'>
            #{tag}
            <button
              type='button'
              aria-label={`Remove ${tag}`}
              onClick={() => onRemoveTag(tag)}
              className='rounded-sm text-muted-foreground transition-colors hover:text-destructive'>
              <X className='size-3' />
            </button>
          </Badge>
        ))}
        <Button
          type='button'
          variant='ghost'
          size='sm'
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className='size-8 rounded-full p-0'
          aria-label={open ? 'Close editorial details' : 'Edit authors, tags, and story details'}>
          <Plus className={`size-4 transition-transform ${open ? 'rotate-45' : ''}`} />
        </Button>
      </div>

      {open ? (
        <div className='mt-5 grid gap-6 rounded-md border border-border/70 bg-card/30 p-5 md:grid-cols-2'>
          <UserSearch
            label='Authors'
            selectedUsers={selectedCreators}
            onSelectionChange={onCreatorChange}
            showSelectedUsers={false}
          />
          <TagsInput
            tags={formData.tags}
            availableTags={availableTags}
            label='Tags'
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            contentTypeLabel='Editorial'
            showSelectedTags={false}
          />
          <div className='space-y-3'>
            <Label>Artwork</Label>
            {artworkUrl ? (
              <div className='relative max-w-sm overflow-hidden rounded-sm border border-border/70 bg-black/20'>
                <img
                  src={artworkUrl}
                  alt='Editorial artwork preview'
                  className='aspect-[16/9] w-full object-cover'
                />
                <Button
                  type='button'
                  variant='destructive'
                  size='icon'
                  onClick={onRemoveArtwork}
                  className='absolute right-2 top-2 size-8'
                  aria-label='Remove editorial artwork'>
                  <X className='size-4' />
                </Button>
              </div>
            ) : (
              <label
                htmlFor={artworkUploadId}
                className='flex min-h-28 max-w-sm cursor-pointer items-center justify-center gap-3 rounded-sm border border-dashed border-border bg-background/25 px-4 text-sm transition-colors hover:border-highlight hover:bg-background/40 focus-within:ring-2 focus-within:ring-ring'>
                <ImageIcon className='size-5' />
                <span>Upload artwork</span>
                <Upload className='size-4 text-muted-foreground' />
              </label>
            )}
            <Input
              id={artworkUploadId}
              type='file'
              accept='image/*'
              onChange={onArtworkFileChange}
              className='sr-only'
            />
            <Input
              aria-label='Artwork URL'
              value={formData.thumbnailUrl}
              onChange={(event) => onThumbnailUrlChange(event.target.value)}
              placeholder='Artwork URL'
            />
            {artworkFile ? (
              <p className='text-xs text-muted-foreground'>{artworkFile.name} selected</p>
            ) : null}
          </div>
          <div className='space-y-2'>
            <Label htmlFor='editorial-slug'>Story URL</Label>
            <Input
              id='editorial-slug'
              value={formData.slug}
              onChange={(event) => onSlugChange(event.target.value)}
              placeholder='generated-from-title'
            />
            <p className='text-xs leading-relaxed text-muted-foreground'>
              Leave blank to generate this from the title.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
