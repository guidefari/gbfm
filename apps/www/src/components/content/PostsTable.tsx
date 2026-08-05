import { Badge, Button, Checkbox, TabsContent } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import type { ContentScope, PostListItem } from './types'

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
  value,
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
  onOpenEditDialog
}: {
  value: 'editorial' | 'tweet'
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
}) {
  const showCreators = scope === 'all'
  const columnCount = showCreators ? 10 : 9
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id))

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
                <th className='w-10 px-4 py-3 text-left font-medium'>
                  <Checkbox
                    checked={allSelected}
                    aria-label={`Select all ${emptyLabel.toLowerCase()}`}
                    onCheckedChange={() => onToggleAll(items.map((item) => item.id))}
                  />
                </th>
                <th className='px-4 py-3 text-left font-medium'>Title</th>
                <th className='px-4 py-3 text-left font-medium'>Slug</th>
                <th className='px-4 py-3 text-left font-medium'>Status</th>
                <th className='px-4 py-3 text-left font-medium'>Media</th>
                <th className='px-4 py-3 text-left font-medium'>Tags</th>
                {showCreators && <th className='px-4 py-3 text-left font-medium'>Created By</th>}
                <th className='px-4 py-3 text-left font-medium'>Created</th>
                <th className='px-4 py-3 text-left font-medium'>Actions</th>
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
                  <td className='px-4 py-3'>{post.title || titleFallback}</td>
                  <td className='px-4 py-3 text-muted-foreground'>{post.slug}</td>
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
                  <td className='px-4 py-3 text-muted-foreground'>
                    {post.tags?.join(', ') || '—'}
                  </td>
                  {showCreators && (
                    <td className='px-4 py-3 text-muted-foreground'>
                      {post.creators?.map((c) => c.name).join(', ') || '—'}
                    </td>
                  )}
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
                  <td colSpan={columnCount} className='px-4 py-8 text-center text-muted-foreground'>
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
