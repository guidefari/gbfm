import { Button } from './button'
import { cn } from '../lib/cn'

interface TablePaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  isLoading = false
}: TablePaginationProps) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1)
  const canGoPrevious = page > 1 && !isLoading
  const canGoNext = page < totalPages && !isLoading

  return (
    <div className={cn('flex items-center justify-between gap-3')}>
      <p className='text-base text-muted-foreground'>
        Page {page} of {totalPages}
      </p>
      <div className='flex gap-2'>
        <Button variant='outline' onClick={() => onPageChange(page - 1)} disabled={!canGoPrevious}>
          Previous
        </Button>
        <Button variant='outline' onClick={() => onPageChange(page + 1)} disabled={!canGoNext}>
          Next
        </Button>
      </div>
    </div>
  )
}
