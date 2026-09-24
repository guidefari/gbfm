'use client'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  TagsInput
} from '@gbfm/ui'
import { Loader2, Send } from 'lucide-react'
import { type ChangeEvent, useId } from 'react'
import { EditorialMetadataPanel } from './-EditorialMetadataSidebar'
import { MusicCover } from './-MusicSlot'
import type { EditorialCreator, EditorialFormData } from './-editorial-types'
import { TWEET_MAX_LENGTH } from './-tweet-hashtags'

export type ComposerType = 'micro' | 'post'

const types = [
  { value: 'micro', label: 'Tweet' },
  { value: 'post', label: 'Editorial' }
] as const

export function PublishDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: ComposerType
  onTypeChange: (type: ComposerType) => void
  title: string
  content: string
  tags: string[]
  availableTags: readonly string[]
  isSaving: boolean
  canPublish: boolean
  isEditMode: boolean
  tweetOverLimit: boolean
  tweetCount: number
  description: string
  slug: string
  thumbnailUrl: string
  artworkPreview: string | null
  artworkFile: File | null
  selectedCreators: EditorialCreator[]
  coverImageUrl: string | null
  entityTitle: string | null
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onDescriptionChange: (value: string) => void
  onSlugChange: (value: string) => void
  onThumbnailUrlChange: (value: string) => void
  onArtworkFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveArtwork: () => void
  onCreatorChange: (creators: EditorialCreator[]) => void
  onPublish: () => void
}) {
  const artworkUploadId = useId()
  const isTweet = props.type === 'micro'

  const editorialFormData: EditorialFormData = {
    title: props.title,
    description: props.description,
    slug: props.slug,
    content: props.content,
    thumbnailUrl: props.thumbnailUrl,
    tags: props.tags,
    draft: false
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{props.isEditMode ? 'Update post' : 'Ready to publish'}</DialogTitle>
        </DialogHeader>

        <div className='space-y-6 py-2'>
          <div className='space-y-2'>
            <Label>Post type</Label>
            <div className='inline-flex border border-border/70 bg-gb-darker-bg p-0.5'>
              {types.map((entry) => {
                const active = entry.value === props.type
                return (
                  <button
                    key={entry.value}
                    type='button'
                    onClick={() => props.onTypeChange(entry.value)}
                    className={`px-5 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-gb-pastel-green-2 text-gb-darker-bg'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {entry.label}
                  </button>
                )
              })}
            </div>
            {isTweet && props.tweetOverLimit ? (
              <p className='text-xs text-destructive'>
                Tweets are capped at {TWEET_MAX_LENGTH} characters ({props.tweetCount}). Trim the
                title or switch to Editorial.
              </p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <Label>Preview</Label>
            <div className='space-y-2 border border-border/60 bg-gb-darker-bg p-4'>
              <p className='break-words text-lg font-semibold text-foreground'>
                {props.title || <span className='text-muted-foreground/60'>Untitled</span>}
              </p>
              {props.content ? (
                <p className='line-clamp-4 whitespace-pre-wrap break-words text-sm text-muted-foreground'>
                  {props.content}
                </p>
              ) : null}
              {props.entityTitle ? (
                <div className='flex items-center gap-3 border border-border/40 bg-black/20 p-2'>
                  <MusicCover url={props.coverImageUrl} isResolving={false} size='sm' />
                  <div className='text-sm text-foreground'>{props.entityTitle}</div>
                </div>
              ) : null}
              {props.tags.length > 0 ? (
                <div className='flex flex-wrap gap-x-3 gap-y-1'>
                  {props.tags.map((tag) => (
                    <span key={tag} className='text-xs text-muted-foreground'>
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {!isTweet ? (
            <EditorialMetadataPanel
              formData={editorialFormData}
              artworkFile={props.artworkFile}
              artworkPreview={props.artworkPreview}
              artworkUploadId={artworkUploadId}
              selectedCreators={props.selectedCreators}
              onArtworkFileChange={props.onArtworkFileChange}
              onRemoveArtwork={props.onRemoveArtwork}
              onThumbnailUrlChange={props.onThumbnailUrlChange}
              onSlugChange={props.onSlugChange}
              onCreatorChange={props.onCreatorChange}
            />
          ) : null}

          <div className='space-y-2'>
            <Label>Tags</Label>
            <TagsInput
              tags={props.tags}
              availableTags={props.availableTags}
              label=''
              onAddTag={props.onAddTag}
              onRemoveTag={props.onRemoveTag}
              contentTypeLabel={isTweet ? 'Tweet' : 'Editorial'}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='ghost'
            onClick={() => props.onOpenChange(false)}
            disabled={props.isSaving}>
            Keep editing
          </Button>
          <Button
            type='button'
            onClick={props.onPublish}
            disabled={!props.canPublish || props.isSaving}
            className='gap-1.5'>
            {props.isSaving ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Send className='size-4' />
            )}
            {props.isEditMode ? 'Update' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
