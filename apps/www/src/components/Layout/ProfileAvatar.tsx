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
import { signOut, useSession } from '@/lib/auth-client'
import { useAuthStore } from '@/store/auth'

const ProfileAvatar = () => {
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const { clearAuth } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
    clearAuth()
    navigate({ to: '/' })
  }

  if (isPending) {
    return (
      <Button
        variant='outline'
        size='icon'
        className='overflow-hidden rounded-sm'
        disabled
      />
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          size='icon'
          className='overflow-hidden rounded-sm'>
          {session?.user?.name?.[0]?.toUpperCase() || '?'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {!session ? (
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
