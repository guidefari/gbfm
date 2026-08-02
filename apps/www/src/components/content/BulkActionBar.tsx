import { Button } from '@gbfm/ui'

export function BulkActionBar({
  selectedCount,
  isPending,
  onPublish,
  onUnpublish,
  onClear
}: {
  selectedCount: number
  isPending: boolean
  onPublish: () => void
  onUnpublish: () => void
  onClear: () => void
}) {
  if (selectedCount === 0) return null

  return (
    <div className='flex flex-wrap items-center gap-3 rounded-sm border bg-muted/50 px-4 py-3'>
      <span className='text-sm font-medium'>{selectedCount} selected</span>
      <div className='flex flex-wrap gap-2'>
        <Button size='sm' onClick={onPublish} disabled={isPending}>
          {isPending ? 'Working…' : `Publish ${selectedCount}`}
        </Button>
        <Button size='sm' variant='outline' onClick={onUnpublish} disabled={isPending}>
          Move to draft
        </Button>
        <Button size='sm' variant='ghost' onClick={onClear} disabled={isPending}>
          Clear
        </Button>
      </div>
    </div>
  )
}
