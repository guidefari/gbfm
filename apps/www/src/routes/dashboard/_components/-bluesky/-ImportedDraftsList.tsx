import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  toast
} from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ExternalLink, Inbox, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { apiUrl, apiUrlObj, fetcher, type PaginatedResponse } from '@/lib/http'

type ImportedPost = {
  id: string
  title: string | null
  slug: string
  content: string | null
  draft: boolean
  createdAt: string
  blueskySource?: {
    authorHandle: string | null
    publicUrl: string
    sourceCreatedAt: string
    sourceStatus: string
    locallyEdited: boolean
  }
}

const PAGE_SIZE = 20

const statusOptions = {
  draft: 'Needs review',
  live: 'Published',
  all: 'All'
} as const

type StatusFilter = keyof typeof statusOptions

function isStatusFilter(value: string): value is StatusFilter {
  return value in statusOptions
}

function DraftRow({
  post,
  onPublish,
  isPublishing
}: {
  post: ImportedPost
  onPublish: (post: ImportedPost) => void
  isPublishing: boolean
}) {
  const excerpt = post.content?.trim() || post.title || 'Untitled post'

  return (
    <li className='flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between'>
      <div className='min-w-0 flex-1 space-y-2'>
        <p className='line-clamp-3 whitespace-pre-wrap text-sm text-foreground'>{excerpt}</p>
        <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          <Badge variant={post.draft ? 'secondary' : 'default'}>
            {post.draft ? 'Draft' : 'Live'}
          </Badge>
          {post.blueskySource?.locallyEdited ? <Badge variant='outline'>Edited here</Badge> : null}
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
          {post.blueskySource ? (
            <a
              href={post.blueskySource.publicUrl}
              target='_blank'
              rel='noreferrer'
              className='inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground'>
              View on Bluesky
              <ExternalLink className='size-3' />
            </a>
          ) : null}
        </div>
      </div>

      <div className='flex shrink-0 flex-wrap gap-2'>
        <Button variant='outline' size='sm' asChild>
          <Link to='/new/tweet' search={{ edit: post.slug }}>
            Edit
          </Link>
        </Button>
        {post.draft ? (
          <Button size='sm' onClick={() => onPublish(post)} disabled={isPublishing}>
            Publish
          </Button>
        ) : (
          <Button variant='outline' size='sm' asChild>
            <Link to='/tweet/$slug' params={{ slug: post.slug }}>
              View
            </Link>
          </Button>
        )}
      </div>
    </li>
  )
}

function EmptyState({ status }: { status: StatusFilter }) {
  return (
    <div className='flex flex-col items-center gap-2 px-4 py-16 text-center'>
      <Inbox className='size-8 text-muted-foreground' />
      <p className='text-sm font-medium'>
        {status === 'draft' ? 'Nothing left to review' : 'No imported posts yet'}
      </p>
      <p className='max-w-sm text-sm text-muted-foreground'>
        {status === 'draft'
          ? 'Every imported post has been handled. Run a sync to pull in newer posts.'
          : 'Run a sync to import your Bluesky music posts as drafts.'}
      </p>
    </div>
  )
}

export function ImportedDraftsList() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StatusFilter>('draft')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const query = useQuery({
    queryKey: ['admin', 'bluesky', 'imported', status, search, offset],
    queryFn: () => {
      const url = apiUrlObj('/content/posts/manage')
      url.searchParams.set('source', 'bluesky')
      url.searchParams.set('type', 'micro')
      url.searchParams.set('limit', String(PAGE_SIZE))
      url.searchParams.set('offset', String(offset))
      if (status !== 'all') url.searchParams.set('status', status)
      if (search.trim()) url.searchParams.set('q', search.trim())
      return fetcher<PaginatedResponse<ImportedPost>>(url.toString())
    }
  })

  const publish = useMutation({
    mutationFn: (post: ImportedPost) =>
      fetcher(apiUrl(`/content/posts/${post.slug}`), {
        method: 'PATCH',
        body: JSON.stringify({ draft: false, type: 'micro' })
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'bluesky', 'imported'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] })
      toast({ title: 'Post published' })
    },
    onError: (err: Error) =>
      toast({ title: 'Failed to publish', description: err.message, variant: 'destructive' })
  })

  const posts = query.data?.data ?? []
  const pagination = query.data?.pagination
  const total = pagination?.total ?? 0

  const changeFilter = (next: string) => {
    if (!isStatusFilter(next)) return
    setStatus(next)
    setOffset(0)
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-medium'>Imported posts</h2>
          <p className='text-sm text-muted-foreground'>
            Review what the sync pulled in, then publish or edit.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setOffset(0)
            }}
            placeholder='Search imported posts'
            className='w-56'
          />
          <Select value={status} onValueChange={changeFilter}>
            <SelectTrigger className='w-44'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusOptions).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='rounded-sm border border-border'>
        {query.isPending ? (
          <div className='space-y-3 p-4'>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className='h-16 w-full' />
            ))}
          </div>
        ) : query.isError ? (
          <div className='flex flex-col items-center gap-3 px-4 py-16 text-center'>
            <TriangleAlert className='size-8 text-destructive' />
            <p className='text-sm font-medium'>Could not load imported posts</p>
            <p className='max-w-sm text-sm text-muted-foreground'>{query.error.message}</p>
            <Button variant='outline' size='sm' onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <EmptyState status={status} />
        ) : (
          <ul>
            {posts.map((post) => (
              <DraftRow
                key={post.id}
                post={post}
                onPublish={publish.mutate}
                isPublishing={publish.isPending}
              />
            ))}
          </ul>
        )}
      </div>

      {total > PAGE_SIZE ? (
        <div className='flex items-center justify-between'>
          <p className='text-sm text-muted-foreground'>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </p>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={offset === 0}
              onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}>
              Previous
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={!pagination?.hasMore}
              onClick={() => setOffset((current) => current + PAGE_SIZE)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
