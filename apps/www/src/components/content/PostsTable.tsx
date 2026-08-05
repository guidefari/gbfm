import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { ExternalLink, MoreHorizontal } from 'lucide-react'
import type { PaginatedResponse } from '@/lib/http'
import { TablePagination } from './TablePagination'
import { PAGE_SIZE, type ContentScope, type PostListItem } from './types'

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

function postExcerpt(content: string | null) {
  const collapsed = content?.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  return collapsed.length > 80 ? `${collapsed.slice(0, 80)}…` : collapsed
}

function StatusToggle({
  post,
  isPending,
  onToggle
}: {
  post: PostListItem
  isPending: boolean
  onToggle: () => void
}) {
  return (
    <button
      type='button'
      onClick={onToggle}
      disabled={isPending}
      title={post.draft ? 'Publish this post' : 'Move back to draft'}
      className='rounded-sm disabled:opacity-50'>
      <Badge variant={post.draft ? 'secondary' : 'default'} className='cursor-pointer'>
        {post.draft ? 'Draft' : 'Live'}
      </Badge>
    </button>
  )
}

export function PostsTable({
  isPending,
  items,
  emptyLabel,
  actionKind,
  titleFallback,
  scope,
  selectedIds,
  togglingSlug,
  onToggleSelected,
  onToggleAll,
  onToggleDraft,
  onOpenEditDialog,
  pagination,
  offset,
  onOffsetChange
}: {
  isPending: boolean
  items: PostListItem[]
  emptyLabel: string
  actionKind: 'editorial' | 'tweet'
  titleFallback?: string
  scope: ContentScope
  selectedIds: ReadonlySet<string>
  togglingSlug: string | null
  onToggleSelected: (id: string) => void
  onToggleAll: (ids: string[]) => void
  onToggleDraft: (post: PostListItem) => void
  onOpenEditDialog: (post: PostListItem, type: 'post' | 'micro') => void
  pagination?: PaginatedResponse<unknown>['pagination']
  offset: number
  onOffsetChange: (offset: number) => void
}) {
  const showCreators = scope === 'all'
  const columnCount = showCreators ? 9 : 8
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id))

  return (
    <div className='mt-4'>
      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>
          Loading {emptyLabel.toLowerCase()}…
        </div>
      ) : (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-base'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='w-10 px-4 py-3 text-left font-medium'>
                  <Checkbox
                    checked={allSelected}
                    aria-label={`Select all ${emptyLabel.toLowerCase()}`}
                    onCheckedChange={() => onToggleAll(items.map((item) => item.id))}
                  />
                </th>
                <th className='px-4 py-3 text-left font-medium'>Title</th>
                <th className='px-4 py-3 text-left font-medium'>Status</th>
                <th className='px-4 py-3 text-left font-medium'>Media</th>
                <th className='px-4 py-3 text-left font-medium'>Tags</th>
                <th className='px-4 py-3 text-left font-medium'>Source</th>
                {showCreators && <th className='px-4 py-3 text-left font-medium'>Created By</th>}
                <th className='px-4 py-3 text-left font-medium'>Created</th>
                <th className='whitespace-nowrap px-4 py-3 text-right font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((post) => (
                <tr key={post.id} className='border-b hover:bg-muted/50'>
                  <td className='px-4 py-3'>
                    <Checkbox
                      checked={selectedIds.has(post.id)}
                      aria-label={`Select ${post.title || post.slug}`}
                      onCheckedChange={() => onToggleSelected(post.id)}
                    />
                  </td>
                  <td className='max-w-[320px] px-4 py-3'>
                    <div className='truncate' title={post.title ?? undefined}>
                      {post.title || postExcerpt(post.content) || titleFallback}
                    </div>
                    <div className='truncate text-xs text-muted-foreground' title={post.slug}>
                      {post.slug}
                    </div>
                  </td>
                  <td className='px-4 py-3'>
                    <StatusToggle
                      post={post}
                      isPending={togglingSlug === post.slug}
                      onToggle={() => onToggleDraft(post)}
                    />
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
                  {showCreators && (
                    <td className='max-w-[140px] truncate px-4 py-3 text-muted-foreground'>
                      {post.creators?.map((c) => c.name).join(', ') || '—'}
                    </td>
                  )}
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
                  <td colSpan={columnCount} className='px-4 py-8 text-center text-muted-foreground'>
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
    </div>
  )
}
