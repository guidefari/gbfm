import { Badge, Button, TabsContent } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { ArrowUpDown } from 'lucide-react'
import type { PaginatedResponse } from '@/lib/http'
import { TablePagination } from './TablePagination'
import { PAGE_SIZE, type AudioItem, type ContentScope, type ContentView } from './types'

export function MixesTable({
  isPending,
  mixes,
  sort,
  order,
  scope,
  onToggleSort,
  onOpenEditDialog,
  pagination,
  offset,
  onOffsetChange
}: {
  isPending: boolean
  mixes: AudioItem[]
  sort: ContentView['sort']
  order: ContentView['order']
  scope: ContentScope
  onToggleSort: () => void
  onOpenEditDialog: (mix: AudioItem) => void
  pagination?: PaginatedResponse<unknown>['pagination']
  offset: number
  onOffsetChange: (offset: number) => void
}) {
  const showCreators = scope === 'all'
  const columnCount = showCreators ? 7 : 6

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
                {showCreators && <th className='px-4 py-3 text-left font-medium'>Created By</th>}
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
                  {showCreators && (
                    <td className='max-w-[140px] truncate px-4 py-3 text-muted-foreground'>
                      {mix.creators?.map((c) => c.name).join(', ') || '—'}
                    </td>
                  )}
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
                  <td colSpan={columnCount} className='px-4 py-8 text-center text-muted-foreground'>
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
