import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@gbfm/ui'
import { ExternalLink, Save } from 'lucide-react'
import { AudioMetadataFields, PostMetadataFields } from './MetadataFields'
import type { AudioEditValues, EditDialogState, PostEditDialogState, PostEditValues } from './types'

export function MetadataDrawer({
  audioState,
  postState,
  isPending,
  onAudioOpenChange,
  onPostOpenChange,
  onAudioChange,
  onPostChange,
  onAudioTagAdd,
  onAudioTagRemove,
  onPostTagAdd,
  onPostTagRemove,
  onSaveAudio,
  onSavePost
}: {
  audioState: EditDialogState
  postState: PostEditDialogState
  isPending: boolean
  onAudioOpenChange: (open: boolean) => void
  onPostOpenChange: (open: boolean) => void
  onAudioChange: (field: keyof AudioEditValues, value: string | boolean) => void
  onPostChange: (field: keyof PostEditValues, value: string | boolean) => void
  onAudioTagAdd: (tag: string) => void
  onAudioTagRemove: (tag: string) => void
  onPostTagAdd: (tag: string) => void
  onPostTagRemove: (tag: string) => void
  onSaveAudio: () => void
  onSavePost: () => void
}) {
  const open = audioState.open || postState.open
  const isAudio = audioState.open
  const title = isAudio ? audioState.values.title : postState.values.title || 'Tweet'
  const viewLink = isAudio
    ? audioState.values.slug
      ? `/mixes/${audioState.values.slug}`
      : undefined
    : postState.values.slug
      ? postState.type === 'post'
        ? `/editorial/${postState.values.slug}`
        : `/tweet/${postState.values.slug}`
      : undefined

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (isAudio) onAudioOpenChange(nextOpen)
        else onPostOpenChange(nextOpen)
      }}>
      <SheetContent side='right' className='flex w-full flex-col overflow-hidden sm:max-w-2xl'>
        <SheetHeader className='shrink-0 pr-8'>
          <SheetTitle>{title || 'Edit content'}</SheetTitle>
          <SheetDescription>
            Edit metadata, publishing state, media URLs, tags, and MDX content from one panel.
          </SheetDescription>
        </SheetHeader>

        <div className='min-h-0 flex-1 space-y-6 overflow-y-auto py-6 pr-2'>
          {isAudio ? (
            <AudioMetadataFields
              values={audioState.values}
              onChange={onAudioChange}
              onAddTag={onAudioTagAdd}
              onRemoveTag={onAudioTagRemove}
            />
          ) : (
            <PostMetadataFields
              values={postState.values}
              postType={postState.type}
              onChange={onPostChange}
              onAddTag={onPostTagAdd}
              onRemoveTag={onPostTagRemove}
            />
          )}
        </div>

        <SheetFooter className='shrink-0 gap-2 border-t pt-4 sm:justify-between'>
          <div className='flex gap-2'>
            {viewLink && (
              <Button variant='outline' size='sm' asChild>
                <a href={viewLink} target='_blank' rel='noreferrer'>
                  <ExternalLink className='mr-2 size-4' />
                  View
                </a>
              </Button>
            )}
          </div>
          <Button onClick={isAudio ? onSaveAudio : onSavePost} disabled={isPending}>
            <Save className='mr-2 size-4' />
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
