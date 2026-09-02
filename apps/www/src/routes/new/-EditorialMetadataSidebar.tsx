import { Button, Input, Label, TagsInput } from '@gbfm/ui'
import { ImageIcon, Upload, X } from 'lucide-react'
import type { ChangeEvent, ReactNode } from 'react'
import { usePostTags } from '@/lib/http'
import { UserSearch } from '../dashboard/_components/-UserSearch'
import type { EditorialCreator, EditorialFormData } from './-editorial-types'

function MetadataSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='border-b border-border/70 pb-6 last:border-b-0 last:pb-0'>
      <h2 className='mb-4 text-xs font-semibold tracking-[0.14em] text-foreground uppercase'>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function EditorialMetadataSidebar({
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
  const artworkUrl = artworkPreview || formData.thumbnailUrl
  const { data: availableTags } = usePostTags()

  return (
    <aside
      className='space-y-6 rounded-sm border border-border/70 bg-card/35 p-5 [&_input]:bg-background/35 [&_label]:text-sm lg:sticky lg:top-[76px] lg:mt-8 lg:self-start'
      aria-label='Editorial metadata'>
      <MetadataSection title='Artwork'>
        <div className='space-y-3'>
          {artworkUrl ? (
            <div className='relative overflow-hidden rounded-sm border border-gb-pastel-green-2/20 bg-black/20'>
              <img
                src={artworkUrl}
                alt='Editorial artwork preview'
                className='aspect-[16/10] w-full object-cover'
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
              className='flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-sm border border-dashed border-border bg-background/25 px-4 py-6 text-center transition-colors hover:border-highlight hover:bg-background/40 focus-within:ring-2 focus-within:ring-ring'>
              <ImageIcon className='size-6 text-foreground' />
              <span className='text-sm font-medium text-foreground'>Upload artwork</span>
              <span className='text-xs text-muted-foreground'>PNG, JPG, or WEBP, up to 10MB</span>
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
          <div className='space-y-1.5'>
            <Label
              htmlFor='editorial-artwork-url'
              className='text-xs font-medium tracking-wide text-muted-foreground'>
              Artwork URL
            </Label>
            <Input
              id='editorial-artwork-url'
              value={formData.thumbnailUrl}
              onChange={(event) => onThumbnailUrlChange(event.target.value)}
              placeholder='https://…'
            />
          </div>
          {artworkFile ? (
            <p className='text-xs text-muted-foreground'>{artworkFile.name} selected</p>
          ) : null}
        </div>
      </MetadataSection>

      <MetadataSection title='URL'>
        <div className='space-y-1.5'>
          <Label htmlFor='editorial-slug'>Slug</Label>
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
      </MetadataSection>

      <MetadataSection title='Creator'>
        <UserSearch
          label='Creator'
          selectedUsers={selectedCreators}
          onSelectionChange={onCreatorChange}
        />
      </MetadataSection>

      <MetadataSection title='Tags'>
        <TagsInput
          tags={formData.tags}
          availableTags={availableTags}
          label='Choose tags'
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          contentTypeLabel='Editorial'
        />
      </MetadataSection>
    </aside>
  )
}
