import { Button, Input, Label } from '@gbfm/ui'
import { ImageIcon, Upload, X } from 'lucide-react'
import type { ChangeEvent } from 'react'
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
  onCreatorChange: (creators: EditorialCreator[]) => void
}) {
  const artworkUrl = artworkPreview || formData.thumbnailUrl

  return (
    <section className='mt-6 grid gap-6 md:grid-cols-2' aria-label='Editorial details'>
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

      <div className='space-y-6'>
        <UserSearch
          label='Authors'
          selectedUsers={selectedCreators}
          onSelectionChange={onCreatorChange}
          showSelectedUsers
        />
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
    </section>
  )
}
