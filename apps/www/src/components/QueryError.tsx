import { Button } from '@gbfm/ui'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface QueryErrorProps {
  error: unknown
  onRetry?: () => void
  message?: string
}

export function QueryError({ error, onRetry, message }: QueryErrorProps) {
  const isOnline = useOnlineStatus()
  const errorMessage = error instanceof Error ? error.message : String(error)
  const isOffline =
    !isOnline || errorMessage.toLowerCase().includes('failed to fetch')

  return (
    <div className='flex flex-col items-center justify-center gap-3 py-16 text-center'>
      {isOffline && <WifiOff className='w-8 h-8 text-muted-foreground/50' />}
      <p className='text-sm font-medium text-muted-foreground'>
        {message ?? (isOffline ? 'No connection' : 'Failed to load content')}
      </p>
      {onRetry && (
        <Button variant='outline' size='sm' onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
