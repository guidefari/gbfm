import { Button, Input, Label, Textarea, toast } from '@gbfm/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { RadioTower } from 'lucide-react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { MusicEntityPicker } from '@/components/editor/music-entity/MusicEntityPicker'
import {
  SimpleMarkdownEditor,
  type SimpleMarkdownEditorHandle
} from '@/components/simple-markdown-editor'
import { ExternalMediaPickerDialog } from '@/components/editorial/ExternalMediaPickerDialog'
import { resolveMusicEntityBatchEffect } from '@/components/editorial/editorial-music-resolution'
import { useSession } from '@/lib/auth-client'
import { resolveMusicEntityReferenceWithCacheEffect } from '@/lib/music-entity-resolution'
import type { EditorialFormData, EditorialTextField } from './-editorial-types'

export function EditorialWritingCanvas({
  formData,
  portalContainer,
  metadata,
  onInputChange,
  onPendingMusicChange
}: {
  formData: EditorialFormData
  portalContainer?: HTMLElement | null
  metadata: ReactNode
  onInputChange: (field: EditorialTextField, value: string) => void
  onPendingMusicChange: (count: number) => void
}) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const authorizationScope = session?.user
    ? `${session.user.id}:${session.user.role ?? 'user'}`
    : 'anonymous'
  const editorRef = useRef<SimpleMarkdownEditorHandle>(null)
  const [externalMediaOpen, setExternalMediaOpen] = useState(false)

  const insertBlock = (markdown: string) => {
    editorRef.current?.insertAtCursor(`\n\n${markdown.trim()}\n\n`)
  }

  const resolveMusicEntities = useCallback(
    (urls: ReadonlyArray<string>) =>
      Effect.runPromise(
        resolveMusicEntityBatchEffect(urls, (url) =>
          resolveMusicEntityReferenceWithCacheEffect(
            queryClient,
            url,
            authorizationScope,
            'editorial'
          )
        )
      ),
    [authorizationScope, queryClient]
  )

  const reportResolutionFailure = useCallback((count: number) => {
    toast({
      title: count === 1 ? 'Could not add one music link' : `Could not add ${count} music links`,
      description: 'The original Spotify links were kept in your story.',
      variant: 'destructive'
    })
  }, [])

  return (
    <main className='min-w-0 py-8'>
      <div className='pb-7'>
        <Label htmlFor='editorial-title' className='sr-only'>
          Title
        </Label>
        <Input
          id='editorial-title'
          value={formData.title}
          onChange={(event) => onInputChange('title', event.target.value)}
          placeholder='Story title'
          maxLength={255}
          autoFocus
          style={{ boxShadow: 'none' }}
          className='h-auto !border-0 bg-transparent px-0 text-3xl font-semibold tracking-tight text-foreground !shadow-none placeholder:text-muted-foreground/55 focus-visible:!ring-0 sm:text-4xl'
        />

        <div className='mt-3 max-w-3xl'>
          <Label htmlFor='editorial-description' className='sr-only'>
            Description
          </Label>
          <Textarea
            id='editorial-description'
            value={formData.description}
            onChange={(event) => onInputChange('description', event.target.value)}
            placeholder='Add a short description…'
            style={{ boxShadow: 'none' }}
            className='h-auto min-h-12 resize-none !border-0 bg-transparent px-0 py-1 text-base leading-relaxed text-muted-foreground !shadow-none placeholder:text-muted-foreground/55 focus-visible:!ring-0'
          />
        </div>
        {metadata}
      </div>

      <section aria-label='Editorial content'>
        <SimpleMarkdownEditor
          ref={editorRef}
          value={formData.content}
          onChange={(value) => onInputChange('content', value)}
          placeholder='Start writing…'
          resolveMusicEntities={resolveMusicEntities}
          onPendingMusicChange={onPendingMusicChange}
          onMusicResolutionFailure={reportResolutionFailure}
          toolbarActions={
            <>
              <MusicEntityPicker onInsert={insertBlock} portalContainer={portalContainer} />
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => setExternalMediaOpen(true)}
                className='h-9 gap-1.5 px-2 text-xs'>
                <RadioTower className='size-4' />
                Media
              </Button>
            </>
          }
        />
        <ExternalMediaPickerDialog
          open={externalMediaOpen}
          portalContainer={portalContainer}
          onOpenChange={setExternalMediaOpen}
          onInsert={insertBlock}
        />
      </section>
    </main>
  )
}
