import type { User } from '@/store/auth'

interface WelcomeHeaderProps {
  user: User
}

export function WelcomeHeader({ user }: WelcomeHeaderProps) {
  const firstName = user.name?.split(' ')[0] || 'there'

  return (
    <div className='flex items-center gap-4'>
      {user.image && (
        <img
          src={user.image}
          alt={user.name || 'User avatar'}
          className='w-16 h-16 rounded-full object-cover'
        />
      )}
      <div>
        <h1 className='text-2xl font-bold'>Welcome back, {firstName}</h1>
        <p className='text-muted-foreground'>Here's what's happening</p>
      </div>
    </div>
  )
}
