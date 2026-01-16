'use client'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/lib/auth-client'
import { useAuthStore } from '@/store/auth'

const ProfileAvatar = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated, clearAuth } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
    clearAuth()
    navigate({ to: '/' })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          size='icon'
          className='overflow-hidden rounded-sm'>
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name}
              className='h-full w-full object-cover'
            />
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
              <Link to='/settings/profile'>Profile</Link>
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
