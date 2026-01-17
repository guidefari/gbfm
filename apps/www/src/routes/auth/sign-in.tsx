import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { GenericAuthForm } from '@/components/Auth/GenericForm'
import { toast } from '@/components/ui/use-toast'
import { signIn } from '@/lib/auth-client'
import { useAuthStore } from '@/store/auth'

export const Route = createFileRoute('/auth/sign-in')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({
        to: '/'
      })
    }
  },
  component: SignInPage
})

function SignInPage() {
  const [error, setError] = useState<string>('')
  const navigate = Route.useNavigate()
  const { setUser } = useAuthStore()

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const result = await signIn.email({
        email,
        password
      })

      if (result.data) {
        toast({
          title: 'Sign in successful!',
          description: 'Redirecting to home page...',
          variant: 'default'
        })
        setError('')
        setUser(result.data.user)
        navigate({ to: '/' })
      } else if (result.error) {
        setError(result.error.message || 'Failed to sign in')
      }
    } catch (_err) {
      setError('Failed to sign in')
    }
  }

  return (
    <div className=''>
      <div className='mx-auto space-y-8 w-full max-w-md'>
        {error && (
          <div className='p-4 text-sm text-red-700 bg-red-100 rounded-md'>
            {error}
          </div>
        )}

        <GenericAuthForm
          formTitle='Sign In'
          fields={[
            {
              name: 'email',
              label: 'Email',
              type: 'email',
              placeholder: 'name@example.com',
              required: true
            },
            {
              name: 'password',
              label: 'Password',
              type: 'password',
              placeholder: 'Enter your password',
              required: true
            }
          ]}
          onSubmit={onSubmit}
          submitButtonText='Sign In'
        />

        <div className='text-center'>
          <p className='text-sm text-gray-500'>
            Don't have an account? <Link to='/auth/sign-up'>Sign up</Link>
          </p>
          <p className='text-sm text-gray-500'>
            Forgot password? <Link to='/auth/forgot-password'>Reset here</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
