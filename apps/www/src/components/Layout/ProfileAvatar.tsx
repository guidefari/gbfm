'use client'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@gbfm/ui'
import { Link, useNavigate } from '@tanstack/react-router'
import { signOut, useSession } from '@/lib/auth-client'
import { useUIStore } from '@/store/ui'

const ProfileAvatar = () => {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const user = session?.user
  const isAuthenticated = Boolean(session?.user)
  const resetUI = useUIStore((s) => s.resetUI)

  const handleSignOut = async () => {
    await signOut()
    resetUI()
    navigate({ to: '/' })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='icon' className='overflow-hidden rounded-sm'>
          {user?.image ? (
            <img src={user.image} alt={user.name} className='h-full w-full object-cover' />
          ) : (
            user?.name?.[0]?.toUpperCase() || '?'
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {!isAuthenticated ? (
          <DropdownMenuItem
            className='hover:cursor-pointer'
            onClick={() => navigate({ to: '/auth/sign-in' })}>
            Sign In
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link to='/dashboard' className='w-full'>
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to='/settings' className='w-full'>
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>Logout</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ProfileAvatar
