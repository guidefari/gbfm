import { Input, Label, Textarea } from '@gbfm/ui'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import type { EditorialFormData, EditorialTextField } from './-editorial-types'

export function EditorialWritingCanvas({
  formData,
  onInputChange
}: {
  formData: EditorialFormData
  onInputChange: (field: EditorialTextField, value: string) => void
}) {
  return (
    <main className='min-w-0 py-8 sm:py-10'>
      <div className='border-b border-gb-pastel-green-2/15 pb-8'>
        <Label htmlFor='editorial-title' className='sr-only'>
          Title
        </Label>
        <Input
          id='editorial-title'
          value={formData.title}
          onChange={(event) => onInputChange('title', event.target.value)}
          placeholder='Give your story a title'
          maxLength={255}
          autoFocus
          className='h-auto border-0 bg-transparent px-0 text-4xl font-semibold tracking-tight text-gb-pastel-green-1 shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 sm:text-5xl'
        />

        <div className='mt-5 max-w-3xl'>
          <Label htmlFor='editorial-description' className='sr-only'>
            Description
          </Label>
          <Textarea
            id='editorial-description'
            value={formData.description}
            onChange={(event) => onInputChange('description', event.target.value)}
            placeholder='Introduce the piece in a sentence or two.'
            className='min-h-20 resize-y border-0 bg-transparent px-0 text-lg leading-relaxed text-muted-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0'
          />
        </div>

        <details className='mt-5 max-w-xl text-sm'>
          <summary className='cursor-pointer text-muted-foreground hover:text-foreground'>
            Advanced settings
          </summary>
          <div className='mt-3 space-y-1.5'>
            <Label
              htmlFor='editorial-slug'
              className='text-xs font-medium tracking-wide text-muted-foreground'>
              URL slug
            </Label>
            <Input
              id='editorial-slug'
              value={formData.slug}
              onChange={(event) => onInputChange('slug', event.target.value)}
              placeholder='generated-from-the-title'
            />
            <p className='text-xs text-muted-foreground'>
              Leave blank to generate a slug from the title.
            </p>
          </div>
        </details>
      </div>

      <section className='pt-8' aria-labelledby='editorial-content-heading'>
        <div className='mb-4 flex items-baseline justify-between gap-4'>
          <h2
            id='editorial-content-heading'
            className='text-sm font-medium tracking-wide text-muted-foreground'>
            Story
          </h2>
          <span className='text-xs text-muted-foreground'>Markdown supported</span>
        </div>
        <SimpleMarkdownEditor
          value={formData.content}
          onChange={(value) => onInputChange('content', value)}
          placeholder='Start writing…'
        />
      </section>
    </main>
  )
}
