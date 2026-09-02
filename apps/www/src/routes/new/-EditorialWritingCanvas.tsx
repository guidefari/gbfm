import { Button, Input, Label, Textarea } from '@gbfm/ui'
import { RadioTower } from 'lucide-react'
import { useRef, useState } from 'react'
import { MusicEntityPicker } from '@/components/editor/music-entity/MusicEntityPicker'
import {
  SimpleMarkdownEditor,
  type SimpleMarkdownEditorHandle
} from '@/components/simple-markdown-editor'
import { ExternalMediaPickerDialog } from '@/components/editorial/ExternalMediaPickerDialog'
import type { EditorialFormData, EditorialTextField } from './-editorial-types'

export function EditorialWritingCanvas({
  formData,
  onInputChange
}: {
  formData: EditorialFormData
  onInputChange: (field: EditorialTextField, value: string) => void
}) {
  const editorRef = useRef<SimpleMarkdownEditorHandle>(null)
  const [externalMediaOpen, setExternalMediaOpen] = useState(false)

  const insertBlock = (markdown: string) => {
    editorRef.current?.insertAtCursor(`\n\n${markdown.trim()}\n\n`)
  }

  return (
    <main className='min-w-0 py-8'>
      <div className='border-b border-border/70 pb-7'>
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
            placeholder='A short introduction.'
            style={{ boxShadow: 'none' }}
            className='min-h-16 resize-y !border-0 bg-transparent px-0 text-base leading-relaxed text-muted-foreground !shadow-none placeholder:text-muted-foreground/55 focus-visible:!ring-0'
          />
        </div>
      </div>

      <section className='pt-7' aria-labelledby='editorial-content-heading'>
        <div className='mb-4 flex flex-wrap items-end justify-between gap-4'>
          <div>
            <h2
              id='editorial-content-heading'
              className='text-sm font-medium tracking-wide text-muted-foreground'>
              Story
            </h2>
            <span className='text-xs text-muted-foreground'>
              Markdown with music and media embeds
            </span>
          </div>
          <div className='flex flex-wrap items-center gap-2' aria-label='Insert content'>
            <MusicEntityPicker onInsert={insertBlock} />
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setExternalMediaOpen(true)}
              className='h-9 gap-2 px-3.5 text-sm'>
              <RadioTower className='size-4' />
              Embed media
            </Button>
          </div>
        </div>
        <SimpleMarkdownEditor
          ref={editorRef}
          value={formData.content}
          onChange={(value) => onInputChange('content', value)}
          placeholder='Start writing…'
        />
        <ExternalMediaPickerDialog
          open={externalMediaOpen}
          onOpenChange={setExternalMediaOpen}
          onInsert={insertBlock}
        />
      </section>
    </main>
  )
}
