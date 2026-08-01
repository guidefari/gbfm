import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role='status'
      aria-live='polite'
      className='flex items-center justify-center gap-2 bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-base text-destructive'>
      <WifiOff className='w-4 h-4 shrink-0' />
      <span>No internet connection</span>
    </div>
  )
}
