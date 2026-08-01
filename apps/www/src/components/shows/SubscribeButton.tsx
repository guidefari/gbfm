import { Button, toast } from '@gbfm/ui'
import { useNavigate } from '@tanstack/react-router'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { useSubscribeToShow, useUnsubscribeFromShow, useUserSubscriptions } from '@/lib/http'
import { cn } from '@/lib/utils'

interface SubscribeButtonProps {
  showId: string
  showTitle: string
  iconOnly?: boolean
  className?: string
}

export function SubscribeButton({
  showId,
  showTitle,
  iconOnly = false,
  className
}: SubscribeButtonProps) {
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
  const navigate = useNavigate()
  const { data: subscriptions } = useUserSubscriptions()
  const { subscribe, isPending: isSubscribing } = useSubscribeToShow()
  const { unsubscribe, isPending: isUnsubscribing } = useUnsubscribeFromShow()

  const isSubscribed = subscriptions.some((sub) => sub.showId === showId)
  const isLoading = isSubscribing || isUnsubscribing
  const label = isSubscribed ? 'Unsubscribe' : 'Subscribe'

  const handleClick = async () => {
    if (!isAuthenticated) {
      toast({
        title: 'Sign in required',
        description: 'Sign in to subscribe to shows'
      })
      navigate({ to: '/auth/sign-in' })
      return
    }

    try {
      if (isSubscribed) {
        await unsubscribe({ showId })
        toast({
          title: 'Unsubscribed',
          description: `You've unsubscribed from ${showTitle}`
        })
      } else {
        await subscribe({ showId })
        toast({
          title: 'Subscribed',
          description: `You've subscribed to ${showTitle}`
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive'
      })
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      variant={iconOnly ? 'ghost' : isSubscribed ? 'outline' : 'default'}
      size={iconOnly ? 'icon' : 'default'}
      aria-label={iconOnly ? label : undefined}
      title={label}
      className={cn('gap-2', iconOnly && 'h-9 w-9 rounded-none', className)}>
      {isLoading ? (
        <Loader2 className='w-4 h-4 animate-spin' />
      ) : isSubscribed ? (
        <BellOff className='w-4 h-4' />
      ) : (
        <Bell className='w-4 h-4' />
      )}
      {!iconOnly && (isSubscribed ? 'Subscribed' : 'Subscribe')}
    </Button>
  )
}
