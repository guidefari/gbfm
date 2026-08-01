import { Button } from '@gbfm/ui'
import { Link, useRouter } from '@tanstack/react-router'
import { SearchX, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isNotFoundError } from '@/lib/http-errors'

interface RouteErrorProps {
  error: unknown
  backLink?: ReactNode
}

export function RouteError({ error, backLink }: RouteErrorProps) {
  const router = useRouter()
  const isOnline = useOnlineStatus()
  const message = error instanceof Error ? error.message : String(error)
  const isOffline = !isOnline || message.toLowerCase().includes('failed to fetch')
  const isNotFound = !isOffline && isNotFoundError(error)

  return (
    <div className='max-w-3xl px-4 py-6 mx-auto'>
      {backLink && <div className='mb-8'>{backLink}</div>}
      <div className='flex flex-col items-center gap-3 py-16 text-center'>
        {isOffline && <WifiOff className='w-8 h-8 text-muted-foreground/50' />}
        {isNotFound && <SearchX className='w-8 h-8 text-muted-foreground/50' />}
        <p className='text-base font-medium text-muted-foreground'>
          {isOffline ? 'No connection' : isNotFound ? 'Not found' : 'Failed to load'}
        </p>
        {isNotFound ? (
          !backLink && (
            <Button variant='outline' size='sm' asChild>
              <Link to='/'>Go home</Link>
            </Button>
          )
        ) : (
          <Button variant='outline' size='sm' onClick={() => router.invalidate()}>
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}
