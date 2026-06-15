import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  TagsInput,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast
} from '@gbfm/ui'
import type { SelectMdxCompiledEditorialPost, SelectMdxCompiledMicroPost } from '@gbfm/vps/schemas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpDown, ExternalLink, Plus, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import { apiUrl, fetcher, type PaginatedResponse } from '@/lib/http'
import { ImageUploadField } from './-ImageUploadField'

interface AudioItem {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  slug: string
  content: string
  draft: boolean
  type: string
  url: string
  showId: string | null
  episodeNumber: number | null
  createdAt: string
  playCount: number
  tags?: string[] | null
  creators?: Array<{ id: string; name: string }>
}

interface LabelItem {
  id: string
  name: string
  slug: string
  description: string | null
  content: string
  thumbnailUrl: string | null
  website: string | null
  bandcamp: string | null
  discogs: string | null
  createdAt: string
}

type EditorialPostItem = Omit<
  SelectMdxCompiledEditorialPost,
  'createdAt' | 'updatedAt' | 'creators'
> & {
  createdAt: string
  creators?: Array<{ id: string; name: string }>
}

type TweetPostItem = Omit<SelectMdxCompiledMicroPost, 'createdAt' | 'updatedAt' | 'creators'> & {
  createdAt: string
  creators?: Array<{ id: string; name: string }>
}

interface EditDialogState {
  open: boolean
  mix: AudioItem | null
  values: AudioEditValues
}

interface PostEditDialogState {
  open: boolean
  post: PostListItem | null
  values: PostEditValues
  type: 'post' | 'micro'
}

interface AudioEditValues {
  title: string
  description: string
  slug: string
  content: string
  thumbnailUrl: string
  url: string
  tags: string[]
  draft: boolean
  episodeNumber: string
}

interface PostEditValues {
  title: string
  description: string
  slug: string
  content: string
  thumbnailUrl: string
  tags: string[]
  draft: boolean
}

type PostListItem = {
  id: string
  title: string | null
  description: string | null
  thumbnailUrl: string | null
  slug: string
  content: string | null
  draft: boolean
  type: 'post' | 'micro' | null
  tags?: string[] | null
  creators?: Array<{ id: string; name: string }>
  createdAt: string
}

const emptyAudioEditValues: AudioEditValues = {
  title: '',
  description: '',
  slug: '',
  content: '',
  thumbnailUrl: '',
  url: '',
  tags: [],
  draft: false,
  episodeNumber: ''
}

const emptyPostEditValues: PostEditValues = {
  title: '',
  description: '',
  slug: '',
  content: '',
  thumbnailUrl: '',
  tags: [],
  draft: false
}

function toAudioEditValues(mix: AudioItem): AudioEditValues {
  return {
    title: mix.title || '',
    description: mix.description || '',
    slug: mix.slug || '',
    content: mix.content || '',
    thumbnailUrl: mix.thumbnailUrl || '',
    url: mix.url || '',
    tags: mix.tags || [],
    draft: mix.draft ?? false,
    episodeNumber: mix.episodeNumber ? String(mix.episodeNumber) : ''
  }
}

function toPostEditValues(post: PostListItem): PostEditValues {
  return {
    title: post.title || '',
    description: post.description || '',
    slug: post.slug || '',
    content: post.content || '',
    thumbnailUrl: post.thumbnailUrl || '',
    tags: post.tags || [],
    draft: post.draft ?? false
  }
}

function NewContentButtons() {
  return (
    <div className='flex flex-wrap gap-2'>
      <Button asChild size='sm'>
        <Link to='/new/editorial' search={{ edit: undefined }}>
          <Plus className='mr-2 size-4' />
          New editorial
        </Link>
      </Button>
      <Button asChild size='sm' variant='outline'>
        <Link to='/new/tweet' search={{ edit: undefined }}>
          <Plus className='mr-2 size-4' />
          New tweet
        </Link>
      </Button>
    </div>
  )
}

function MixesTabContent({
  isPending,
  mixes,
  mixPlaySortOrder,
  onToggleSort,
  onOpenEditDialog
}: {
  isPending: boolean
  mixes: AudioItem[]
  mixPlaySortOrder: 'asc' | 'desc'
  onToggleSort: () => void
  onOpenEditDialog: (mix: AudioItem) => void
}) {
  return (
    <TabsContent value='mixes' className='mt-4'>
      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>Loading mixes…</div>
      ) : (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left font-medium'>Title</th>
                <th className='px-4 py-3 text-left font-medium'>Slug</th>
                <th className='px-4 py-3 text-left font-medium'>Status</th>
                <th className='px-4 py-3 text-left font-medium'>Media</th>
                <th className='px-4 py-3 text-left font-medium'>Tags</th>
                <th className='px-4 py-3 text-left font-medium'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='-ml-3 h-auto px-3 py-0 font-medium'
                    onClick={onToggleSort}>
                    Plays {mixPlaySortOrder === 'desc' ? '↓' : '↑'}
                    <ArrowUpDown className='ml-2 size-3.5' />
                  </Button>
                </th>
                <th className='px-4 py-3 text-left font-medium'>Created By</th>
                <th className='px-4 py-3 text-left font-medium'>Created</th>
                <th className='px-4 py-3 text-left font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mixes.map((mix) => (
                <tr key={mix.id} className='border-b hover:bg-muted/50'>
                  <td className='px-4 py-3'>{mix.title}</td>
                  <td className='px-4 py-3 text-muted-foreground'>{mix.slug}</td>
                  <td className='px-4 py-3'>
                    <Badge variant={mix.draft ? 'secondary' : 'default'}>
                      {mix.draft ? 'Draft' : 'Live'}
                    </Badge>
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    <div className='flex gap-1'>
                      <Badge variant={mix.url ? 'default' : 'secondary'}>Audio</Badge>
                      <Badge variant={mix.thumbnailUrl ? 'default' : 'secondary'}>Art</Badge>
                      <Badge variant={mix.content?.trim() ? 'default' : 'secondary'}>MDX</Badge>
                    </div>
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>{mix.tags?.join(', ') || '—'}</td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {mix.playCount.toLocaleString()}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {mix.creators?.map((c) => c.name).join(', ') || '—'}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {new Date(mix.createdAt).toLocaleDateString()}
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' onClick={() => onOpenEditDialog(mix)}>
                        Edit
                      </Button>
                      <Button variant='outline' size='sm' asChild>
                        <Link to='/mixes/$mixId' params={{ mixId: mix.slug }}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {mixes.length === 0 && (
                <tr>
                  <td colSpan={9} className='px-4 py-8 text-center text-muted-foreground'>
                    No mixes found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </TabsContent>
  )
}

function PostsTabContent({
  value,
  isPending,
  items,
  emptyLabel,
  actionKind,
  titleFallback,
  onOpenEditDialog
}: {
  value: 'editorial' | 'tweet'
  isPending: boolean
  items: PostListItem[]
  emptyLabel: string
  actionKind: 'editorial' | 'tweet'
  titleFallback?: string
  onOpenEditDialog: (post: PostListItem, type: 'post' | 'micro') => void
}) {
  return (
    <TabsContent value={value} className='mt-4'>
      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>
          Loading {emptyLabel.toLowerCase()}…
        </div>
      ) : (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left font-medium'>Title</th>
                <th className='px-4 py-3 text-left font-medium'>Slug</th>
                <th className='px-4 py-3 text-left font-medium'>Status</th>
                <th className='px-4 py-3 text-left font-medium'>Media</th>
                <th className='px-4 py-3 text-left font-medium'>Tags</th>
                <th className='px-4 py-3 text-left font-medium'>Created By</th>
                <th className='px-4 py-3 text-left font-medium'>Created</th>
                <th className='px-4 py-3 text-left font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((post) => (
                <tr key={post.id} className='border-b hover:bg-muted/50'>
                  <td className='px-4 py-3'>{post.title || titleFallback}</td>
                  <td className='px-4 py-3 text-muted-foreground'>{post.slug}</td>
                  <td className='px-4 py-3'>
                    <Badge variant={post.draft ? 'secondary' : 'default'}>
                      {post.draft ? 'Draft' : 'Live'}
                    </Badge>
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    <div className='flex gap-1'>
                      <Badge variant={post.thumbnailUrl ? 'default' : 'secondary'}>Art</Badge>
                      <Badge variant={post.content?.trim() ? 'default' : 'secondary'}>MDX</Badge>
                    </div>
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {post.tags?.join(', ') || '—'}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {post.creators?.map((c) => c.name).join(', ') || '—'}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </td>
                  <td className='px-4 py-3'>
                    {actionKind === 'editorial' ? (
                      <EditorialPostActions
                        post={post}
                        onEdit={() => onOpenEditDialog(post, 'post')}
                      />
                    ) : (
                      <TweetPostActions
                        post={post}
                        onEdit={() => onOpenEditDialog(post, 'micro')}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className='px-4 py-8 text-center text-muted-foreground'>
                    No {emptyLabel.toLowerCase()} found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </TabsContent>
  )
}

function EditorialPostActions({ post, onEdit }: { post: PostListItem; onEdit: () => void }) {
  return (
    <div className='flex gap-2'>
      <Button variant='outline' size='sm' onClick={onEdit}>
        Edit
      </Button>
      <Button variant='outline' size='sm' asChild>
        <Link to='/editorial/$slug' params={{ slug: post.slug }}>
          View
        </Link>
      </Button>
      <Button variant='outline' size='sm' asChild>
        <Link to='/new/editorial' search={{ edit: post.slug }}>
          Full editor
        </Link>
      </Button>
    </div>
  )
}

function TweetPostActions({ post, onEdit }: { post: PostListItem; onEdit: () => void }) {
  return (
    <div className='flex gap-2'>
      <Button variant='outline' size='sm' onClick={onEdit}>
        Edit
      </Button>
      <Button variant='outline' size='sm' asChild>
        <Link to='/tweet/$slug' params={{ slug: post.slug }}>
          View
        </Link>
      </Button>
      <Button variant='outline' size='sm' asChild>
        <Link to='/new/tweet' search={{ edit: post.slug }}>
          Full editor
        </Link>
      </Button>
    </div>
  )
}

function LabelsTabContent({ isPending, labels }: { isPending: boolean; labels: LabelItem[] }) {
  return (
    <TabsContent value='labels' className='mt-4'>
      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>Loading labels…</div>
      ) : (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left font-medium'>Name</th>
                <th className='px-4 py-3 text-left font-medium'>Slug</th>
                <th className='px-4 py-3 text-left font-medium'>Created</th>
                <th className='px-4 py-3 text-left font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((label) => (
                <tr key={label.id} className='border-b hover:bg-muted/50'>
                  <td className='px-4 py-3'>{label.name}</td>
                  <td className='px-4 py-3 text-muted-foreground'>{label.slug}</td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {new Date(label.createdAt).toLocaleDateString()}
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' asChild>
                        <Link to='/labels/$labelSlug' params={{ labelSlug: label.slug }}>
                          View
                        </Link>
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          window.location.href = `/label-upload?edit=${encodeURIComponent(label.slug)}&title=${encodeURIComponent(label.name || '')}&description=${encodeURIComponent(label.description || '')}&content=${encodeURIComponent(label.content || '')}&thumbnailUrl=${encodeURIComponent(label.thumbnailUrl || '')}`
                        }}>
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {labels.length === 0 && (
                <tr>
                  <td colSpan={4} className='px-4 py-8 text-center text-muted-foreground'>
                    No labels found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </TabsContent>
  )
}

function MetadataDrawer({
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

function AudioMetadataFields({
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

function PostMetadataFields({
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

export function ContentTab() {
  const queryClient = useQueryClient()
  const [mixPlaySortOrder, setMixPlaySortOrder] = useState<'asc' | 'desc'>('desc')
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    mix: null,
    values: emptyAudioEditValues
  })
  const [postEditDialog, setPostEditDialog] = useState<PostEditDialogState>({
    open: false,
    post: null,
    values: emptyPostEditValues,
    type: 'post'
  })

  const { data: mixesData, isPending: mixesPending } = useQuery({
    queryKey: ['admin', 'mixes'],
    queryFn: () =>
      fetcher<PaginatedResponse<AudioItem>>(apiUrl('/content/audio/mix?limit=50&offset=0'))
  })

  const { data: labelsData, isPending: labelsPending } = useQuery({
    queryKey: ['admin', 'labels'],
    queryFn: () =>
      fetcher<PaginatedResponse<LabelItem>>(apiUrl('/content/labels?limit=50&offset=0'))
  })

  const { data: editorialData, isPending: editorialPending } = useQuery({
    queryKey: ['admin', 'posts', 'post'],
    queryFn: () =>
      fetcher<PaginatedResponse<EditorialPostItem>>(
        apiUrl('/content/posts/editorials?limit=50&offset=0')
      )
  })
  const { data: tweetData, isPending: tweetPending } = useQuery({
    queryKey: ['admin', 'posts', 'micro'],
    queryFn: () =>
      fetcher<PaginatedResponse<TweetPostItem>>(apiUrl('/content/posts/micro?limit=50&offset=0'))
  })

  const updateMixMutation = useMutation({
    mutationFn: ({ slug, values }: { slug: string; values: AudioEditValues }) =>
      fetcher(apiUrl(`/content/audio/mix/${slug}`), {
        method: 'PATCH',
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          slug: values.slug,
          content: values.content,
          thumbnailUrl: values.thumbnailUrl,
          url: values.url,
          tags: values.tags,
          draft: values.draft,
          episodeNumber: values.episodeNumber ? Number(values.episodeNumber) : null
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'mixes'] })
      queryClient.invalidateQueries({ queryKey: ['audio', 'mix'] })
      setEditDialog({
        open: false,
        mix: null,
        values: emptyAudioEditValues
      })
      toast({ title: 'Mix updated successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to update mix',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const updatePostMutation = useMutation({
    mutationFn: ({
      slug,
      values,
      type
    }: {
      slug: string
      values: PostEditValues
      type: 'post' | 'micro'
    }) =>
      fetcher(apiUrl(`/content/posts/${slug}`), {
        method: 'PATCH',
        body: JSON.stringify({
          title: values.title.trim() || null,
          description: values.description,
          slug: values.slug,
          content: values.content.trim() ? values.content : null,
          thumbnailUrl: values.thumbnailUrl || null,
          tags: values.tags,
          draft: values.draft,
          type
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts', 'post'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'posts', 'micro'] })
      queryClient.invalidateQueries({ queryKey: ['posts', 'editorials'] })
      setPostEditDialog({
        open: false,
        post: null,
        values: emptyPostEditValues,
        type: 'post'
      })
      toast({ title: 'Post updated successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to update post',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const mixes = mixesData?.data
  const labels = labelsData?.data
  const editorialPosts = editorialData?.data
  const tweetPosts = tweetData?.data

  const sortedMixes = useMemo(() => {
    return (mixes ?? []).toSorted((left, right) =>
      mixPlaySortOrder === 'asc'
        ? left.playCount - right.playCount
        : right.playCount - left.playCount
    )
  }, [mixPlaySortOrder, mixes])

  const openEditDialog = (mix: AudioItem) => {
    setEditDialog({
      open: true,
      mix,
      values: toAudioEditValues(mix)
    })
    setPostEditDialog((prev) => ({ ...prev, open: false }))
  }

  const openPostEditDialog = (post: PostListItem, type: 'post' | 'micro') => {
    setPostEditDialog({
      open: true,
      post,
      values: toPostEditValues(post),
      type
    })
    setEditDialog((prev) => ({ ...prev, open: false }))
  }

  const updateAudioValue = (field: keyof AudioEditValues, value: string | boolean) => {
    setEditDialog((prev) => ({
      ...prev,
      values: { ...prev.values, [field]: value }
    }))
  }

  const updatePostValue = (field: keyof PostEditValues, value: string | boolean) => {
    setPostEditDialog((prev) => ({
      ...prev,
      values: { ...prev.values, [field]: value }
    }))
  }

  const addAudioTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase()
    if (trimmedTag && !editDialog.values.tags.includes(trimmedTag)) {
      setEditDialog((prev) => ({
        ...prev,
        values: { ...prev.values, tags: [...prev.values.tags, trimmedTag] }
      }))
    }
  }

  const removeAudioTag = (tag: string) => {
    setEditDialog((prev) => ({
      ...prev,
      values: { ...prev.values, tags: prev.values.tags.filter((t) => t !== tag) }
    }))
  }

  const addPostTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase()
    if (trimmedTag && !postEditDialog.values.tags.includes(trimmedTag)) {
      setPostEditDialog((prev) => ({
        ...prev,
        values: { ...prev.values, tags: [...prev.values.tags, trimmedTag] }
      }))
    }
  }

  const removePostTag = (tag: string) => {
    setPostEditDialog((prev) => ({
      ...prev,
      values: { ...prev.values, tags: prev.values.tags.filter((t) => t !== tag) }
    }))
  }

  const handleSaveAudio = () => {
    if (!editDialog.mix) return
    updateMixMutation.mutate({ slug: editDialog.mix.slug, values: editDialog.values })
  }

  const handleSavePost = () => {
    if (!postEditDialog.post) return
    updatePostMutation.mutate({
      slug: postEditDialog.post.slug,
      values: postEditDialog.values,
      type: postEditDialog.type
    })
  }

  return (
    <div className='space-y-4'>
      <NewContentButtons />
      <Tabs defaultValue='mixes'>
        <TabsList>
          <TabsTrigger value='mixes'>Mixes ({mixes?.length ?? 0})</TabsTrigger>
          <TabsTrigger value='editorial'>Editorial ({editorialPosts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value='tweet'>Tweet ({tweetPosts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value='labels'>Labels ({labels?.length ?? 0})</TabsTrigger>
        </TabsList>
        <MixesTabContent
          isPending={mixesPending}
          mixes={sortedMixes}
          mixPlaySortOrder={mixPlaySortOrder}
          onToggleSort={() =>
            setMixPlaySortOrder((current) => (current === 'desc' ? 'asc' : 'desc'))
          }
          onOpenEditDialog={openEditDialog}
        />
        <PostsTabContent
          value='editorial'
          isPending={editorialPending}
          items={editorialPosts ?? []}
          emptyLabel='Editorial posts'
          actionKind='editorial'
          onOpenEditDialog={openPostEditDialog}
        />
        <PostsTabContent
          value='tweet'
          isPending={tweetPending}
          items={tweetPosts ?? []}
          emptyLabel='Tweet posts'
          actionKind='tweet'
          titleFallback='Tweet'
          onOpenEditDialog={openPostEditDialog}
        />
        <LabelsTabContent isPending={labelsPending} labels={labels ?? []} />
      </Tabs>
      <MetadataDrawer
        audioState={editDialog}
        postState={postEditDialog}
        isPending={updateMixMutation.isPending || updatePostMutation.isPending}
        onAudioOpenChange={(open) => setEditDialog((prev) => ({ ...prev, open }))}
        onPostOpenChange={(open) => setPostEditDialog((prev) => ({ ...prev, open }))}
        onAudioChange={updateAudioValue}
        onPostChange={updatePostValue}
        onAudioTagAdd={addAudioTag}
        onAudioTagRemove={removeAudioTag}
        onPostTagAdd={addPostTag}
        onPostTagRemove={removePostTag}
        onSaveAudio={handleSaveAudio}
        onSavePost={handleSavePost}
      />
    </div>
  )
}
