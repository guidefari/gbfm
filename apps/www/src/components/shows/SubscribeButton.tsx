import { Button, toast } from '@gbfm/ui'
import { useNavigate } from '@tanstack/react-router'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import {
  useSubscribeToShow,
  useUnsubscribeFromShow,
  useUserSubscriptions
} from '@/lib/http'
import { useSession } from '@/lib/auth-client'

interface SubscribeButtonProps {
  showId: string
  showTitle: string
}

export function SubscribeButton({ showId, showTitle }: SubscribeButtonProps) {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const navigate = useNavigate()
  const { data: subscriptions } = useUserSubscriptions()
  const { subscribe, isPending: isSubscribing } = useSubscribeToShow()
  const { unsubscribe, isPending: isUnsubscribing } = useUnsubscribeFromShow()

  const isSubscribed = subscriptions.some((sub) => sub.showId === showId)
  const isLoading = isSubscribing || isUnsubscribing

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
      variant={isSubscribed ? 'outline' : 'default'}
      className='w-full gap-2'>
      {isLoading ? (
        <Loader2 className='w-4 h-4 animate-spin' />
      ) : isSubscribed ? (
        <BellOff className='w-4 h-4' />
      ) : (
        <Bell className='w-4 h-4' />
      )}
      {isSubscribed ? 'Subscribed' : 'Subscribe'}
    </Button>
  )
}
