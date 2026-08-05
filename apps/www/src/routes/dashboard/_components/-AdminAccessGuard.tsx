import { Link, useLocation } from '@tanstack/react-router'
import { useSession } from '@/lib/auth-client'

export function AdminAccessGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const location = useLocation()
  const isAuthenticated = Boolean(session?.user)
  const user = session?.user

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className='flex items-center justify-center min-h-screen p-4'>
        <div className='text-center'>
          <p className='mb-4 text-lg text-gray-600'>
            {!isAuthenticated
              ? 'Please sign in to access the admin dashboard'
              : 'You need admin privileges to access this page'}
          </p>
          {isAuthenticated ? (
            <Link
              to='/'
              className='inline-flex items-center justify-center px-4 py-2 text-base font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90'>
              Go Home
            </Link>
          ) : (
            <Link
              to='/auth/sign-in'
              search={{ redirect: location.pathname }}
              className='inline-flex items-center justify-center px-4 py-2 text-base font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90'>
              Sign In
            </Link>
          )}
        </div>
      </div>
    )
  }

  return children
}
