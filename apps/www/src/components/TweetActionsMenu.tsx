import { canCreatePosts } from '@gbfm/core/roles'
import { Link } from '@tanstack/react-router'
import { PenSquare } from 'lucide-react'
import { useSession } from '@/lib/auth-client'

export function TweetActionsMenu() {
  const { data: session } = useSession()
  const user = session?.user
  const canCreate = Boolean(user && canCreatePosts(user.role))

  if (!canCreate) return null

  return (
    <Link
      to='/new/tweet'
      aria-label='New tweet'
      className='fixed bottom-[calc(env(safe-area-inset-bottom)+2.75rem+1rem)] right-4 z-30 flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:bg-primary/90 lg:bottom-[3.5rem] lg:right-8'>
      <PenSquare className='h-4 w-4' />
    </Link>
  )
}
