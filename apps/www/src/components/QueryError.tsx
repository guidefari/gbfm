import { Button } from '@gbfm/ui'
import { SearchX, WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isNotFoundError } from '@/lib/http-errors'

interface QueryErrorProps {
  error: unknown
  onRetry?: () => void
  message?: string
}

export function QueryError({ error, onRetry, message }: QueryErrorProps) {
  const isOnline = useOnlineStatus()
  const errorMessage = error instanceof Error ? error.message : String(error)
  const isOffline = !isOnline || errorMessage.toLowerCase().includes('failed to fetch')
  const isNotFound = !isOffline && isNotFoundError(error)

  return (
    <div className='flex flex-col items-center justify-center gap-3 py-16 text-center'>
      {isOffline && <WifiOff className='w-8 h-8 text-muted-foreground/50' />}
      {isNotFound && <SearchX className='w-8 h-8 text-muted-foreground/50' />}
      <p className='text-base font-medium text-muted-foreground'>
        {message ??
          (isOffline ? 'No connection' : isNotFound ? 'Not found' : 'Failed to load content')}
      </p>
      {onRetry && !isNotFound && (
        <Button variant='outline' size='sm' onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
