'use client'

import { Input, Label, TagsInput, Textarea } from '@gbfm/ui'
import { type ReactNode, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { toast } from '@gbfm/ui'
import type { HashtagCompletionOptions } from '@/components/hashtag-tag-complete'
import { resolveMusicEntityBatchEffect } from '@/components/editorial/editorial-music-resolution'
import {
  SimpleMarkdownEditor,
  type SimpleMarkdownEditorHandle
} from '@/components/simple-markdown-editor'
import { useSession } from '@/lib/auth-client'
import { resolveMusicEntityReferenceWithCacheEffect } from '@/lib/music-entity-resolution'

export interface ComposerCanvasProps {
  title: string
  titlePlaceholder: string
  titleHint?: ReactNode
  description?: string
  descriptionPlaceholder?: string
  onDescriptionChange?: (value: string) => void
  content: string
  tags: string[]
  availableTags: readonly string[]
  contentPlaceholder: string
  contentTypeLabel: string
  resolutionScope: 'tweet' | 'editorial'
  musicSlot?: ReactNode
  metadataSlot?: ReactNode
  belowEditorSlot?: ReactNode
  editorToolbarActions?: (insertBlock: (markdown: string) => void) => ReactNode
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onPendingMusicChange?: (count: number) => void
}

export function ComposerCanvas({
  title,
  titlePlaceholder,
  titleHint,
  description,
  descriptionPlaceholder,
  onDescriptionChange,
  content,
  tags,
  availableTags,
  contentPlaceholder,
  contentTypeLabel,
  resolutionScope,
  musicSlot,
  metadataSlot,
  belowEditorSlot,
  editorToolbarActions,
  onTitleChange,
  onContentChange,
  onAddTag,
  onRemoveTag,
  onPendingMusicChange
}: ComposerCanvasProps) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const authorizationScope = session?.user
    ? `${session.user.id}:${session.user.role ?? 'user'}`
    : 'anonymous'
  const editorRef = useRef<SimpleMarkdownEditorHandle>(null)

  const insertBlock = useCallback((markdown: string) => {
    editorRef.current?.insertAtCursor(`\n\n${markdown.trim()}\n\n`)
  }, [])

  const resolveMusicEntities = useCallback(
    (urls: ReadonlyArray<string>) =>
      Effect.runPromise(
        resolveMusicEntityBatchEffect(urls, (url) =>
          resolveMusicEntityReferenceWithCacheEffect(
            queryClient,
            url,
            authorizationScope,
            resolutionScope
          )
        )
      ),
    [authorizationScope, queryClient, resolutionScope]
  )

  const reportResolutionFailure = useCallback((count: number) => {
    toast({
      title: count === 1 ? 'Could not add one music link' : `Could not add ${count} music links`,
      description: 'The original links were kept in your text.',
      variant: 'destructive'
    })
  }, [])

  const tagCompletion: HashtagCompletionOptions = {
    getAvailableTags: () => availableTags,
    getSelectedTags: () => tags,
    onSelectTag: onAddTag
  }

  return (
    <div className='pt-8'>
      <div className='pb-6'>
        {titleHint ? <div className='mb-2 flex justify-end'>{titleHint}</div> : null}
        <Label htmlFor='composer-title' className='sr-only'>
          Title
        </Label>
        <Input
          id='composer-title'
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={titlePlaceholder}
          autoFocus
          style={{ boxShadow: 'none' }}
          className='h-auto !border-0 bg-transparent px-0 text-3xl font-semibold tracking-tight text-foreground !shadow-none placeholder:text-muted-foreground/55 focus-visible:!ring-0 sm:text-4xl'
        />
        {onDescriptionChange ? (
          <div className='mt-3 max-w-3xl'>
            <Label htmlFor='composer-description' className='sr-only'>
              Description
            </Label>
            <Textarea
              id='composer-description'
              value={description ?? ''}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder={descriptionPlaceholder ?? 'Add a short description…'}
              style={{ boxShadow: 'none' }}
              className='h-auto min-h-12 resize-none !border-0 bg-transparent px-0 py-1 text-base leading-relaxed text-muted-foreground !shadow-none placeholder:text-muted-foreground/55 focus-visible:!ring-0'
            />
          </div>
        ) : null}
        {metadataSlot}
      </div>

      {musicSlot ? <div className='pb-6'>{musicSlot}</div> : null}

      <div className='pb-6'>
        <TagsInput
          tags={tags}
          availableTags={availableTags}
          label='Tags'
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          contentTypeLabel={contentTypeLabel}
        />
      </div>

      <section aria-label='Content'>
        <SimpleMarkdownEditor
          ref={editorRef}
          value={content}
          onChange={onContentChange}
          placeholder={contentPlaceholder}
          resolveMusicEntities={resolveMusicEntities}
          onPendingMusicChange={onPendingMusicChange}
          onMusicResolutionFailure={reportResolutionFailure}
          tagCompletion={tagCompletion}
          toolbarActions={editorToolbarActions?.(insertBlock)}
        />
        {belowEditorSlot}
      </section>
    </div>
  )
}
