import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { GenericAuthForm } from '@/components/Auth/GenericForm'
import { toast } from '@/components/ui/use-toast'
import { VPS_BASE_URL } from '@/lib/http'
import { useAuthStore } from '@/store/auth'

export const Route = createFileRoute('/auth/sign-in')({
  component: SignInPage
})

function SignInPage() {
  const [error, setError] = useState<string>('')
  const navigate = Route.useNavigate()
  const { setAuth } = useAuthStore()

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const response = await fetch(`${VPS_BASE_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: 'Sign in successful!',
          description: 'Redirecting to home page...',
          variant: 'default'
        })
        setError('')

        setAuth({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken
        })

        navigate({ to: '/' })
      } else {
        setError(data.error || 'Failed to sign in')
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
