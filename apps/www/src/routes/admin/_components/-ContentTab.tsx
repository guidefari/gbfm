import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowUpDown, ExternalLink, MoreHorizontal, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { SimpleMarkdownEditor } from '@/components/simple-markdown-editor'
import { apiUrl, fetcher, type PaginatedResponse } from '@/lib/http'
import { ImageUploadField } from './-ImageUploadField'
import { TablePagination } from './-TablePagination'

const PAGE_SIZE = 25

const contentTabs = { mixes: true, editorial: true, tweet: true }

function isContentTab(value: string): value is keyof typeof contentTabs {
  return value in contentTabs
}

function postExcerpt(content: string | null) {
  const collapsed = content?.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  return collapsed.length > 80 ? `${collapsed.slice(0, 80)}…` : collapsed
}

type PaginationMeta = PaginatedResponse<unknown>['pagination']

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
  blueskySource?: { publicUrl: string }
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
  sort,
  order,
  onToggleSort,
  onOpenEditDialog,
  pagination,
  offset,
  onOffsetChange
}: {
  isPending: boolean
  mixes: AudioItem[]
  sort: 'plays' | 'created'
  order: 'asc' | 'desc'
  onToggleSort: () => void
  onOpenEditDialog: (mix: AudioItem) => void
  pagination?: PaginationMeta
  offset: number
  onOffsetChange: (offset: number) => void
}) {
  return (
    <TabsContent value='mixes' className='mt-4'>
      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>Loading mixes…</div>
      ) : (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-base'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left font-medium'>Title</th>
                <th className='px-4 py-3 text-left font-medium'>Status</th>
                <th className='px-4 py-3 text-left font-medium'>Media</th>
                <th className='px-4 py-3 text-left font-medium'>Tags</th>
                <th className='px-4 py-3 text-left font-medium'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='-ml-3 h-auto px-3 py-0 font-medium'
                    onClick={onToggleSort}>
                    Plays {sort === 'plays' ? (order === 'desc' ? '↓' : '↑') : ''}
                    <ArrowUpDown className='ml-2 size-3.5' />
                  </Button>
                </th>
                <th className='px-4 py-3 text-left font-medium'>Created</th>
                <th className='whitespace-nowrap px-4 py-3 text-right font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mixes.map((mix) => (
                <tr key={mix.id} className='border-b hover:bg-muted/50'>
                  <td className='max-w-[320px] px-4 py-3'>
                    <div className='truncate' title={mix.title}>
                      {mix.title}
                    </div>
                    <div className='truncate text-xs text-muted-foreground' title={mix.slug}>
                      {mix.slug}
                    </div>
                  </td>
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
                  <td
                    className='max-w-[160px] truncate px-4 py-3 text-muted-foreground'
                    title={mix.tags?.join(', ')}>
                    {mix.tags?.join(', ') || '—'}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {mix.playCount.toLocaleString()}
                  </td>
                  <td className='whitespace-nowrap px-4 py-3 text-muted-foreground'>
                    {new Date(mix.createdAt).toLocaleDateString()}
                  </td>
                  <td className='whitespace-nowrap px-4 py-3 text-right'>
                    <div className='flex justify-end gap-2'>
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
                  <td colSpan={7} className='px-4 py-8 text-center text-muted-foreground'>
                    No mixes found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {pagination && (
        <TablePagination
          offset={offset}
          pageSize={PAGE_SIZE}
          total={pagination.total}
          hasMore={pagination.hasMore}
          onOffsetChange={onOffsetChange}
        />
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
  onOpenEditDialog,
  pagination,
  offset,
  onOffsetChange
}: {
  value: 'editorial' | 'tweet'
  isPending: boolean
  items: PostListItem[]
  emptyLabel: string
  actionKind: 'editorial' | 'tweet'
  titleFallback?: string
  onOpenEditDialog: (post: PostListItem, type: 'post' | 'micro') => void
  pagination?: PaginationMeta
  offset: number
  onOffsetChange: (offset: number) => void
}) {
  return (
    <TabsContent value={value} className='mt-4'>
      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>
          Loading {emptyLabel.toLowerCase()}…
        </div>
      ) : (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-base'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left font-medium'>Title</th>
                <th className='px-4 py-3 text-left font-medium'>Status</th>
                <th className='px-4 py-3 text-left font-medium'>Media</th>
                <th className='px-4 py-3 text-left font-medium'>Tags</th>
                <th className='px-4 py-3 text-left font-medium'>Source</th>
                <th className='px-4 py-3 text-left font-medium'>Created</th>
                <th className='whitespace-nowrap px-4 py-3 text-right font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((post) => (
                <tr key={post.id} className='border-b hover:bg-muted/50'>
                  <td className='max-w-[320px] px-4 py-3'>
                    <div className='truncate' title={post.title ?? undefined}>
                      {post.title || postExcerpt(post.content) || titleFallback}
                    </div>
                    <div className='truncate text-xs text-muted-foreground' title={post.slug}>
                      {post.slug}
                    </div>
                  </td>
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
                  <td
                    className='max-w-[160px] truncate px-4 py-3 text-muted-foreground'
                    title={post.tags?.join(', ')}>
                    {post.tags?.join(', ') || '—'}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {post.blueskySource ? (
                      <a
                        href={post.blueskySource.publicUrl}
                        target='_blank'
                        rel='noreferrer'
                        className='inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground'>
                        Bluesky
                        <ExternalLink className='size-3' />
                      </a>
                    ) : (
                      'Native'
                    )}
                  </td>
                  <td className='whitespace-nowrap px-4 py-3 text-muted-foreground'>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </td>
                  <td className='whitespace-nowrap px-4 py-3 text-right'>
                    <PostRowActions
                      post={post}
                      actionKind={actionKind}
                      onEdit={() =>
                        onOpenEditDialog(post, actionKind === 'editorial' ? 'post' : 'micro')
                      }
                    />
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className='px-4 py-8 text-center text-muted-foreground'>
                    No {emptyLabel.toLowerCase()} found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {pagination && (
        <TablePagination
          offset={offset}
          pageSize={PAGE_SIZE}
          total={pagination.total}
          hasMore={pagination.hasMore}
          onOffsetChange={onOffsetChange}
        />
      )}
    </TabsContent>
  )
}

function PostRowActions({
  post,
  actionKind,
  onEdit
}: {
  post: PostListItem
  actionKind: 'editorial' | 'tweet'
  onEdit: () => void
}) {
  return (
    <div className='flex justify-end gap-2'>
      <Button variant='outline' size='sm' onClick={onEdit}>
        Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='sm' aria-label='More actions'>
            <MoreHorizontal className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem asChild>
            {actionKind === 'editorial' ? (
              <Link to='/editorial/$slug' params={{ slug: post.slug }}>
                View
              </Link>
            ) : (
              <Link to='/tweet/$slug' params={{ slug: post.slug }}>
                View
              </Link>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            {actionKind === 'editorial' ? (
              <Link to='/new/editorial' search={{ edit: post.slug }}>
                Full editor
              </Link>
            ) : (
              <Link to='/new/tweet' search={{ edit: post.slug }}>
                Full editor
              </Link>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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

  const { tab, offset, sort, order } = useSearch({ from: '/admin/content' })
  const navigate = useNavigate({ from: '/admin/content' })

  const setOffset = (next: number) => navigate({ search: (prev) => ({ ...prev, offset: next }) })

  const setTab = (next: string) => {
    if (!isContentTab(next)) return
    navigate({ search: (prev) => ({ ...prev, tab: next, offset: 0 }) })
  }

  const toggleSort = () =>
    navigate({
      search: (prev) => ({
        ...prev,
        sort: 'plays',
        order: prev.sort === 'plays' && prev.order === 'desc' ? 'asc' : 'desc',
        offset: 0
      }),
      replace: true
    })

  const { data: mixesData, isPending: mixesPending } = useQuery({
    queryKey: ['admin', 'mixes', offset, sort, order],
    queryFn: () =>
      fetcher<PaginatedResponse<AudioItem>>(
        apiUrl(
          `/content/audio/mix/manage?limit=${PAGE_SIZE}&offset=${offset}&sort=${sort}&order=${order}`
        )
      ),
    placeholderData: (previous) => previous
  })

  const { data: editorialData, isPending: editorialPending } = useQuery({
    queryKey: ['admin', 'posts', 'post', offset],
    queryFn: () =>
      fetcher<PaginatedResponse<EditorialPostItem>>(
        apiUrl(`/content/posts/manage?type=post&limit=${PAGE_SIZE}&offset=${offset}`)
      ),
    placeholderData: (previous) => previous
  })
  const { data: tweetData, isPending: tweetPending } = useQuery({
    queryKey: ['admin', 'posts', 'micro', offset],
    queryFn: () =>
      fetcher<PaginatedResponse<TweetPostItem>>(
        apiUrl(`/content/posts/manage?type=micro&limit=${PAGE_SIZE}&offset=${offset}`)
      ),
    placeholderData: (previous) => previous
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
          ...(values.episodeNumber ? { episodeNumber: Number(values.episodeNumber) } : {})
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
  const editorialPosts = editorialData?.data
  const tweetPosts = tweetData?.data

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
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value='mixes'>Mixes ({mixesData?.pagination.total ?? 0})</TabsTrigger>
          <TabsTrigger value='editorial'>
            Editorial ({editorialData?.pagination.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value='tweet'>Tweet ({tweetData?.pagination.total ?? 0})</TabsTrigger>
        </TabsList>
        <MixesTabContent
          isPending={mixesPending}
          mixes={mixes ?? []}
          sort={sort}
          order={order}
          onToggleSort={toggleSort}
          onOpenEditDialog={openEditDialog}
          pagination={mixesData?.pagination}
          offset={offset}
          onOffsetChange={setOffset}
        />
        <PostsTabContent
          value='editorial'
          isPending={editorialPending}
          items={editorialPosts ?? []}
          emptyLabel='Editorial posts'
          actionKind='editorial'
          onOpenEditDialog={openPostEditDialog}
          pagination={editorialData?.pagination}
          offset={offset}
          onOffsetChange={setOffset}
        />
        <PostsTabContent
          value='tweet'
          isPending={tweetPending}
          items={tweetPosts ?? []}
          emptyLabel='Tweet posts'
          actionKind='tweet'
          titleFallback='Tweet'
          onOpenEditDialog={openPostEditDialog}
          pagination={tweetData?.pagination}
          offset={offset}
          onOffsetChange={setOffset}
        />
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
