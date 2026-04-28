import type { User } from '@/store/auth'

interface WelcomeHeaderProps {
  user: User
}

export function WelcomeHeader({ user }: WelcomeHeaderProps) {
  const displayName = user.name
  const firstName = displayName.split(' ')[0] || 'there'

  return (
    <div className='flex items-center gap-4 sm:gap-6 py-4'>
      {user.image && (
        <img
          src={user.image}
          alt={displayName || 'User avatar'}
          className='w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-sm object-cover border border-border/60'
        />
      )}
      <div className='min-w-0 flex-1'>
        <h1 className='text-lg sm:text-2xl font-bold leading-tight tracking-tight truncate'>
          Welcome back, {firstName}
        </h1>
        <p className='text-sm sm:text-base text-muted-foreground'>
          Here's what's happening
        </p>
      </div>
    </div>
  )
}
