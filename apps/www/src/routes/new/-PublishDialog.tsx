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
import type { ReactNode } from 'react'

export function PublishDialog({
  open,
  onOpenChange,
  title,
  tags,
  availableTags,
  contentTypeLabel,
  isSaving,
  canPublish,
  publishLabel,
  metadataSlot,
  onAddTag,
  onRemoveTag,
  onPublish
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  tags: string[]
  availableTags: readonly string[]
  contentTypeLabel: string
  isSaving: boolean
  canPublish: boolean
  publishLabel: string
  metadataSlot?: ReactNode
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onPublish: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className='space-y-6 py-2'>
          {metadataSlot}

          <div className='space-y-2'>
            <Label>Tags</Label>
            <TagsInput
              tags={tags}
              availableTags={availableTags}
              label=''
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              contentTypeLabel={contentTypeLabel}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='ghost'
            onClick={() => onOpenChange(false)}
            disabled={isSaving}>
            Keep editing
          </Button>
          <Button
            type='button'
            onClick={onPublish}
            disabled={!canPublish || isSaving}
            className='gap-1.5'>
            {isSaving ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
            {publishLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
