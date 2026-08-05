import { Checkbox, Input, Label, TagsInput, Textarea } from '@gbfm/ui'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import { ImageUploadField } from './ImageUploadField'
import type { AudioEditValues, PostEditValues } from './types'

function ContentStatusField({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className='flex items-center justify-between rounded-sm border p-3'>
      <div>
        <p className='font-medium'>Draft</p>
        <p className='text-xs text-muted-foreground'>
          Keep hidden from public publishing surfaces.
        </p>
      </div>
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
    </div>
  )
}

function TextField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function TextareaField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

export function AudioMetadataFields({
  values,
  onChange,
  onAddTag,
  onRemoveTag
}: {
  values: AudioEditValues
  onChange: (field: keyof AudioEditValues, value: string | boolean) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}) {
  return (
    <div className='space-y-6'>
      <ContentStatusField
        checked={values.draft}
        onChange={(checked) => onChange('draft', checked)}
      />
      <div className='grid gap-4 sm:grid-cols-2'>
        <TextField
          label='Title'
          value={values.title}
          onChange={(value) => onChange('title', value)}
        />
        <TextField label='Slug' value={values.slug} onChange={(value) => onChange('slug', value)} />
      </div>
      <TextareaField
        label='Description'
        value={values.description}
        onChange={(value) => onChange('description', value)}
      />
      <TextField
        label='Audio URL'
        value={values.url}
        onChange={(value) => onChange('url', value)}
      />
      <ImageUploadField
        label='Thumbnail'
        value={values.thumbnailUrl}
        onChange={(value) => onChange('thumbnailUrl', value)}
      />
      <TextField
        label='Episode number'
        value={values.episodeNumber}
        onChange={(value) => onChange('episodeNumber', value)}
      />
      <TagsInput
        tags={values.tags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        contentTypeLabel='mix'
      />
      <div className='space-y-2'>
        <Label>Content (MDX)</Label>
        <SimpleMarkdownEditor
          value={values.content}
          onChange={(value) => onChange('content', value)}
          placeholder='Write mix notes, embeds, and markdown content...'
        />
      </div>
    </div>
  )
}

export function PostMetadataFields({
  values,
  postType,
  onChange,
  onAddTag,
  onRemoveTag
}: {
  values: PostEditValues
  postType: 'post' | 'micro'
  onChange: (field: keyof PostEditValues, value: string | boolean) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}) {
  return (
    <div className='space-y-6'>
      <ContentStatusField
        checked={values.draft}
        onChange={(checked) => onChange('draft', checked)}
      />
      <div className='grid gap-4 sm:grid-cols-2'>
        <TextField
          label='Title'
          value={values.title}
          onChange={(value) => onChange('title', value)}
        />
        <TextField label='Slug' value={values.slug} onChange={(value) => onChange('slug', value)} />
      </div>
      <TextareaField
        label='Description'
        value={values.description}
        onChange={(value) => onChange('description', value)}
      />
      <ImageUploadField
        label='Thumbnail'
        value={values.thumbnailUrl}
        onChange={(value) => onChange('thumbnailUrl', value)}
      />
      <TagsInput
        tags={values.tags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        contentTypeLabel={postType === 'post' ? 'editorial' : 'tweet'}
      />
      <div className='space-y-2'>
        <Label>Content (MDX)</Label>
        <SimpleMarkdownEditor
          value={values.content}
          onChange={(value) => onChange('content', value)}
          placeholder={
            postType === 'post' ? 'Write editorial content...' : 'Write tweet content...'
          }
        />
      </div>
    </div>
  )
}
