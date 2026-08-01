import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { useSession } from '@/lib/auth-client'

const POST_CREATE_ROLES = new Set(['creator', 'editor', 'admin'])

export function NewTweetFab() {
  const { data: session } = useSession()
  const user = session?.user

  if (!user || !POST_CREATE_ROLES.has(user.role ?? '')) return null

  return (
    <Link
      to='/new/tweet'
      aria-label='New tweet'
      className='fixed bottom-[calc(env(safe-area-inset-bottom)+3.75rem)] right-4 z-50 flex h-12 w-12 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:bg-primary/90 lg:bottom-8 lg:right-8'>
      <Pencil className='h-5 w-5' />
    </Link>
  )
}
