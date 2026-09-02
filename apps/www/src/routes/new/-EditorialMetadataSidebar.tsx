import { Button, Checkbox, Input, Label, TagsInput } from '@gbfm/ui'
import { ImageIcon, Upload, X } from 'lucide-react'
import type { ChangeEvent, ReactNode } from 'react'
import { UserSearch } from '../dashboard/_components/-UserSearch'
import type { EditorialCreator, EditorialFormData } from './-editorial-types'

function MetadataSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='border-b border-gb-pastel-green-2/15 pb-7 last:border-b-0'>
      <h2 className='mb-3 text-xs font-semibold tracking-[0.16em] text-gb-pastel-green-1 uppercase'>
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
  onDraftChange,
  onArtworkFileChange,
  onRemoveArtwork,
  onThumbnailUrlChange,
  onAddTag,
  onRemoveTag,
  onCreatorChange
}: {
  formData: EditorialFormData
  artworkFile: File | null
  artworkPreview: string | null
  artworkUploadId: string
  selectedCreators: EditorialCreator[]
  onDraftChange: (draft: boolean) => void
  onArtworkFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveArtwork: () => void
  onThumbnailUrlChange: (value: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onCreatorChange: (creators: EditorialCreator[]) => void
}) {
  const artworkUrl = artworkPreview || formData.thumbnailUrl

  return (
    <aside
      className='space-y-7 border-t border-gb-pastel-green-2/15 py-8 lg:sticky lg:top-[66px] lg:self-start lg:border-t-0 lg:border-l lg:py-10 lg:pl-7'
      aria-label='Editorial metadata'>
      <MetadataSection title='Publishing status'>
        <div className='flex items-start gap-3'>
          <Checkbox
            id='editorial-draft'
            checked={formData.draft}
            onCheckedChange={(checked) => onDraftChange(checked === true)}
          />
          <div className='space-y-1'>
            <Label htmlFor='editorial-draft' className='cursor-pointer font-medium'>
              Keep as draft
            </Label>
            <p className='text-xs leading-relaxed text-muted-foreground'>
              Drafts stay off public publishing surfaces. Use Publish when the piece is ready.
            </p>
          </div>
        </div>
      </MetadataSection>

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
              className='flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-gb-pastel-green-2/40 px-4 py-7 text-center transition-colors hover:border-gb-highlight'>
              <ImageIcon className='size-6 text-gb-pastel-green-1' />
              <span className='text-sm font-medium text-gb-pastel-green-1'>Upload artwork</span>
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
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          contentTypeLabel='Editorial'
        />
      </MetadataSection>
    </aside>
  )
}
