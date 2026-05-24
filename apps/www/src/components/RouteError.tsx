import { Button } from '@gbfm/ui'
import { useRouter } from '@tanstack/react-router'
import { WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface RouteErrorProps {
  error: unknown
  backLink?: ReactNode
}

export function RouteError({ error, backLink }: RouteErrorProps) {
  const router = useRouter()
  const isOnline = useOnlineStatus()
  const message = error instanceof Error ? error.message : String(error)
  const isOffline =
    !isOnline || message.toLowerCase().includes('failed to fetch')

  return (
    <div className='max-w-3xl px-4 py-6 mx-auto'>
      {backLink && <div className='mb-8'>{backLink}</div>}
      <div className='flex flex-col items-center gap-3 py-16 text-center'>
        {isOffline && <WifiOff className='w-8 h-8 text-muted-foreground/50' />}
        <p className='text-sm font-medium text-muted-foreground'>
          {isOffline ? 'No connection' : 'Failed to load'}
        </p>
        <Button variant='outline' size='sm' onClick={() => router.invalidate()}>
          Try again
        </Button>
      </div>
    </div>
  )
}
