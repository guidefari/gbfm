import { useState } from 'react'
import { Badge } from './badge'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Input } from './input'
import { Label } from './label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Textarea } from './textarea'

export type MusicEntityType = 'artist' | 'album' | 'track' | 'playlist' | 'label'

export interface ArtistMetadata {
  name: string
  bio?: string | null
  imageUrl?: string | null
  genres?: string[] | null
  slug: string
  publishedAt?: Date | string | null
}

export interface AlbumMetadata {
  title: string
  artistNames?: string[] | null
  releaseDate?: Date | string | null
  coverImageUrl?: string | null
  genres?: string[] | null
  albumType?: string | null
  slug: string
  publishedAt?: Date | string | null
}

export interface TrackMetadata {
  title: string
  artistNames?: string[] | null
  coverImageUrl?: string | null
  trackNumber?: number | null
  slug: string
  publishedAt?: Date | string | null
}

export interface PlaylistMetadata {
  title: string
  description?: string | null
  coverImageUrl?: string | null
  slug: string
  publishedAt?: Date | string | null
}

export interface LabelMetadata {
  name: string
  description?: string | null
  imageUrl?: string | null
  bannerImageUrl?: string | null
  slug: string
  content: string
  tags?: string[] | null
  genres?: string[] | null
  publishedAt?: Date | string | null
}

export type MusicEntityMetadataFormProps =
  | {
      entityType: 'artist'
      initialData: ArtistMetadata
      onSubmit: (data: ArtistMetadata) => void
      isSaving?: boolean
    }
  | {
      entityType: 'album'
      initialData: AlbumMetadata
      onSubmit: (data: AlbumMetadata) => void
      isSaving?: boolean
    }
  | {
      entityType: 'track'
      initialData: TrackMetadata
      onSubmit: (data: TrackMetadata) => void
      isSaving?: boolean
    }
  | {
      entityType: 'playlist'
      initialData: PlaylistMetadata
      onSubmit: (data: PlaylistMetadata) => void
      isSaving?: boolean
    }
  | {
      entityType: 'label'
      initialData: LabelMetadata
      onSubmit: (data: LabelMetadata) => void
      isSaving?: boolean
    }

function MetadataForm<T>({
  initialData,
  onSubmit,
  isSaving = false,
  children
}: {
  initialData: T
  onSubmit: (data: T) => void
  isSaving?: boolean
  children: (data: T, setData: React.Dispatch<React.SetStateAction<T>>) => React.ReactNode
}) {
  const [data, setData] = useState(initialData)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(data)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base font-medium'>Metadata</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {children(data, setData)}
          <Button type='submit' disabled={isSaving} size='sm'>
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().split('T')[0]
}

function GenreTagInput({
  value,
  onChange
}: {
  value: string[] | null | undefined
  onChange: (v: string[]) => void
}) {
  const tags = value ?? []
  const [input, setInput] = useState('')

  function addTag(raw: string) {
    const trimmed = raw.trim().toLowerCase()
    if (!trimmed || tags.includes(trimmed)) return
    onChange([...tags, trimmed])
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className='flex min-h-9 flex-wrap items-center gap-1.5 rounded-sm border border-input bg-transparent px-3 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-ring'>
      {tags.map((tag) => (
        <Badge key={tag} variant='secondary' className='gap-1 pr-1 text-xs'>
          {tag}
          <button
            type='button'
            onClick={() => removeTag(tag)}
            className='ml-0.5 rounded-sm opacity-60 hover:opacity-100'
            aria-label={`Remove ${tag}`}>
            ×
          </button>
        </Badge>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={tags.length === 0 ? 'Add genre, press Enter' : ''}
        className='min-w-20 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground'
      />
    </div>
  )
}

function ImageField({
  value,
  onChange
}: {
  value: string | null | undefined
  onChange: (v: string) => void
}) {
  return (
    <div className='flex gap-3'>
      {value && (
        <img
          src={value}
          alt=''
          className='h-9 w-9 shrink-0 rounded-sm object-cover'
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder='https://...'
        className='flex-1'
      />
    </div>
  )
}

export function MusicEntityMetadataForm({
  entityType,
  initialData,
  onSubmit,
  isSaving = false
}: MusicEntityMetadataFormProps) {
  if (entityType === 'artist') {
    return (
      <MetadataForm initialData={initialData} onSubmit={onSubmit} isSaving={isSaving}>
        {(data, setData) => (
          <ArtistFields
            data={data}
            set={(key, value) => setData((prev) => ({ ...prev, [key]: value }))}
          />
        )}
      </MetadataForm>
    )
  }

  if (entityType === 'album') {
    return (
      <MetadataForm initialData={initialData} onSubmit={onSubmit} isSaving={isSaving}>
        {(data, setData) => (
          <AlbumFields
            data={data}
            set={(key, value) => setData((prev) => ({ ...prev, [key]: value }))}
          />
        )}
      </MetadataForm>
    )
  }

  if (entityType === 'track') {
    return (
      <MetadataForm initialData={initialData} onSubmit={onSubmit} isSaving={isSaving}>
        {(data, setData) => (
          <TrackFields
            data={data}
            set={(key, value) => setData((prev) => ({ ...prev, [key]: value }))}
          />
        )}
      </MetadataForm>
    )
  }

  if (entityType === 'label') {
    return (
      <MetadataForm initialData={initialData} onSubmit={onSubmit} isSaving={isSaving}>
        {(data, setData) => (
          <LabelFields
            data={data}
            set={(key, value) => setData((prev) => ({ ...prev, [key]: value }))}
          />
        )}
      </MetadataForm>
    )
  }

  return (
    <MetadataForm initialData={initialData} onSubmit={onSubmit} isSaving={isSaving}>
      {(data, setData) => (
        <PlaylistFields
          data={data}
          set={(key, value) => setData((prev) => ({ ...prev, [key]: value }))}
        />
      )}
    </MetadataForm>
  )
}

type SetFn<T> = <K extends keyof T>(key: K, value: T[K]) => void

function ArtistFields({ data, set }: { data: ArtistMetadata; set: SetFn<ArtistMetadata> }) {
  return (
    <>
      <Row>
        <Field label='Name' className='flex-[2]'>
          <Input value={data.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label='Slug' className='flex-1'>
          <Input
            value={data.slug}
            onChange={(e) => set('slug', e.target.value)}
            className='font-mono text-base'
          />
        </Field>
      </Row>
      <Field label='Bio'>
        <Textarea
          value={data.bio ?? ''}
          onChange={(e) => set('bio', e.target.value)}
          className='h-20 resize-none'
        />
      </Field>
      <Row>
        <Field label='Image URL' className='flex-1'>
          <ImageField value={data.imageUrl} onChange={(v) => set('imageUrl', v)} />
        </Field>
        <Field label='Published at' className='w-44 shrink-0'>
          <Input
            type='date'
            value={toDateInputValue(data.publishedAt)}
            onChange={(e) => set('publishedAt', e.target.value ? new Date(e.target.value) : null)}
          />
        </Field>
      </Row>
      <Field label='Genres'>
        <GenreTagInput value={data.genres} onChange={(v) => set('genres', v)} />
      </Field>
    </>
  )
}

function AlbumFields({ data, set }: { data: AlbumMetadata; set: SetFn<AlbumMetadata> }) {
  return (
    <>
      <Row>
        <Field label='Title' className='flex-[2]'>
          <Input value={data.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label='Slug' className='flex-1'>
          <Input
            value={data.slug}
            onChange={(e) => set('slug', e.target.value)}
            className='font-mono text-base'
          />
        </Field>
      </Row>
      <Row>
        <Field label='Album type' className='w-40 shrink-0'>
          <Select value={data.albumType ?? ''} onValueChange={(v) => set('albumType', v)}>
            <SelectTrigger>
              <SelectValue placeholder='Type' />
            </SelectTrigger>
            <SelectContent>
              {['LP', 'EP', 'single', 'compilation'].map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label='Release date' className='w-44 shrink-0'>
          <Input
            type='date'
            value={toDateInputValue(data.releaseDate)}
            onChange={(e) => set('releaseDate', e.target.value ? new Date(e.target.value) : null)}
          />
        </Field>
        <Field label='Published at' className='w-44 shrink-0'>
          <Input
            type='date'
            value={toDateInputValue(data.publishedAt)}
            onChange={(e) => set('publishedAt', e.target.value ? new Date(e.target.value) : null)}
          />
        </Field>
      </Row>
      <Field label='Cover image URL'>
        <ImageField value={data.coverImageUrl} onChange={(v) => set('coverImageUrl', v)} />
      </Field>
      <Field label='Genres'>
        <GenreTagInput value={data.genres} onChange={(v) => set('genres', v)} />
      </Field>
    </>
  )
}

function TrackFields({ data, set }: { data: TrackMetadata; set: SetFn<TrackMetadata> }) {
  return (
    <>
      <Row>
        <Field label='Title' className='flex-[2]'>
          <Input value={data.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label='Slug' className='flex-1'>
          <Input
            value={data.slug}
            onChange={(e) => set('slug', e.target.value)}
            className='font-mono text-base'
          />
        </Field>
      </Row>
      <Row>
        <Field label='Track #' className='w-28 shrink-0'>
          <Input
            type='number'
            value={data.trackNumber ?? ''}
            onChange={(e) => set('trackNumber', e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
        <Field label='Published at' className='w-44 shrink-0'>
          <Input
            type='date'
            value={toDateInputValue(data.publishedAt)}
            onChange={(e) => set('publishedAt', e.target.value ? new Date(e.target.value) : null)}
          />
        </Field>
        <div className='flex-1' />
      </Row>
      <Field label='Cover image URL'>
        <ImageField value={data.coverImageUrl} onChange={(v) => set('coverImageUrl', v)} />
      </Field>
    </>
  )
}

function PlaylistFields({ data, set }: { data: PlaylistMetadata; set: SetFn<PlaylistMetadata> }) {
  return (
    <>
      <Row>
        <Field label='Title' className='flex-[2]'>
          <Input value={data.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label='Slug' className='flex-1'>
          <Input
            value={data.slug}
            onChange={(e) => set('slug', e.target.value)}
            className='font-mono text-base'
          />
        </Field>
      </Row>
      <Field label='Description'>
        <Textarea
          value={data.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          className='h-20 resize-none'
        />
      </Field>
      <Field label='Cover image URL'>
        <ImageField value={data.coverImageUrl} onChange={(v) => set('coverImageUrl', v)} />
      </Field>
    </>
  )
}

function LabelFields({ data, set }: { data: LabelMetadata; set: SetFn<LabelMetadata> }) {
  return (
    <>
      <Row>
        <Field label='Name' className='flex-[2]'>
          <Input value={data.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label='Slug' className='flex-1'>
          <Input
            value={data.slug}
            onChange={(e) => set('slug', e.target.value)}
            className='font-mono text-base'
          />
        </Field>
      </Row>
      <Field label='Description'>
        <Textarea
          value={data.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          className='h-20 resize-none'
        />
      </Field>
      <Row>
        <Field label='Image URL' className='flex-1'>
          <ImageField value={data.imageUrl} onChange={(value) => set('imageUrl', value)} />
        </Field>
        <Field label='Published at' className='w-44 shrink-0'>
          <Input
            type='date'
            value={toDateInputValue(data.publishedAt)}
            onChange={(e) => set('publishedAt', e.target.value ? new Date(e.target.value) : null)}
          />
        </Field>
      </Row>
      <Field label='Banner image URL'>
        <ImageField
          value={data.bannerImageUrl}
          onChange={(value) => set('bannerImageUrl', value)}
        />
      </Field>
      <Field label='Genres'>
        <GenreTagInput value={data.genres} onChange={(value) => set('genres', value)} />
      </Field>
      <Field label='Tags'>
        <GenreTagInput value={data.tags} onChange={(value) => set('tags', value)} />
      </Field>
      <Field label='Content'>
        <Textarea
          value={data.content}
          onChange={(e) => set('content', e.target.value)}
          className='min-h-64 font-mono text-base'
        />
      </Field>
    </>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className='flex flex-wrap items-end gap-3'>{children}</div>
}

function Field({
  label,
  children,
  className
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label className='text-xs text-muted-foreground'>{label}</Label>
      {children}
    </div>
  )
}
