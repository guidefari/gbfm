import { Link } from '@tanstack/react-router'
import { useSession } from '@/lib/auth-client'

export function AdminAccessGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
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
          <Link
            to={isAuthenticated ? '/' : '/auth/sign-in'}
            className='inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90'>
            {isAuthenticated ? 'Go Home' : 'Sign In'}
          </Link>
        </div>
      </div>
    )
  }

  return children
}
