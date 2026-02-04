import type { User } from '@/store/auth'

interface WelcomeHeaderProps {
  user: User
}

export function WelcomeHeader({ user }: WelcomeHeaderProps) {
  const displayName = user.name
  const firstName = displayName.split(' ')[0] || 'there'

  return (
    <div className='flex items-center gap-6 py-4'>
      {user.image && (
        <img
          src={user.image}
          alt={displayName || 'User avatar'}
          className='w-16 h-16 rounded-none object-cover border-2 border-border'
        />
      )}
      <div>
        <h1 className='text-2xl font-bold leading-tight tracking-tight'>
          Welcome back, {firstName}
        </h1>
        <p className='text-base text-muted-foreground'>
          Here's what's happening
        </p>
      </div>
    </div>
  )
}
