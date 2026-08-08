import { Button } from '@gbfm/ui'

export function TablePagination({
  offset,
  pageSize,
  total,
  hasMore,
  onOffsetChange
}: {
  offset: number
  pageSize: number
  total: number
  hasMore: boolean
  onOffsetChange: (offset: number) => void
}) {
  if (total <= pageSize) return null

  return (
    <div className='flex items-center justify-between pt-4'>
      <p className='text-sm text-muted-foreground'>
        {offset + 1}–{Math.min(offset + pageSize, total)} of {total}
      </p>
      <div className='flex gap-2'>
        <Button
          variant='outline'
          size='sm'
          disabled={offset === 0}
          onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}>
          Previous
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={!hasMore}
          onClick={() => onOffsetChange(offset + pageSize)}>
          Next
        </Button>
      </div>
    </div>
  )
}
