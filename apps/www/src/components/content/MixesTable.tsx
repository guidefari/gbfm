import { Badge, Button, TabsContent } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { ArrowUpDown } from 'lucide-react'
import type { AudioItem, ContentScope } from './types'

export function MixesTable({
  isPending,
  mixes,
  mixPlaySortOrder,
  scope,
  onToggleSort,
  onOpenEditDialog
}: {
  isPending: boolean
  mixes: AudioItem[]
  mixPlaySortOrder: 'asc' | 'desc'
  scope: ContentScope
  onToggleSort: () => void
  onOpenEditDialog: (mix: AudioItem) => void
}) {
  const showCreators = scope === 'all'
  const columnCount = showCreators ? 9 : 8

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
                {showCreators && <th className='px-4 py-3 text-left font-medium'>Created By</th>}
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
                  {showCreators && (
                    <td className='px-4 py-3 text-muted-foreground'>
                      {mix.creators?.map((c) => c.name).join(', ') || '—'}
                    </td>
                  )}
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
                  <td colSpan={columnCount} className='px-4 py-8 text-center text-muted-foreground'>
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
