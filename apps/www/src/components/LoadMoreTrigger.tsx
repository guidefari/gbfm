import { forwardRef, useEffect, useRef } from 'react'
import { useIntersectionObserver } from '@/lib/useIntersectionObserver'

interface LoadMoreTriggerProps {
  onLoadMore: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  className?: string
}

export const LoadMoreTrigger = forwardRef<HTMLDivElement, LoadMoreTriggerProps>(
  ({ onLoadMore, hasNextPage, isFetchingNextPage, className = '' }, ref) => {
    const triggerRef = useRef<HTMLDivElement>(null)
    const entry = useIntersectionObserver(triggerRef, {
      threshold: 0.1,
      rootMargin: '100px'
    })

    useEffect(() => {
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        onLoadMore()
      }
    }, [entry?.isIntersecting, hasNextPage, isFetchingNextPage, onLoadMore])

    // Don't render if there's no more data to load
    if (!hasNextPage && !isFetchingNextPage) {
      return null
    }

    return (
      <div
        ref={(node) => {
          triggerRef.current = node
          if (typeof ref === 'function') {
            ref(node)
          } else if (ref) {
            ref.current = node
          }
        }}
        className={`flex items-center justify-center py-8 ${className}`}
        data-testid='load-more-trigger'>
        {isFetchingNextPage && (
          <div className='flex items-center gap-2 text-base text-foreground/60'>
            <div className='w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground/60 rounded-full animate-spin' />
            Loading more...
          </div>
        )}
        {hasNextPage && !isFetchingNextPage && (
          <div className='h-4' /> // Invisible spacer to trigger intersection
        )}
      </div>
    )
  }
)

LoadMoreTrigger.displayName = 'LoadMoreTrigger'
