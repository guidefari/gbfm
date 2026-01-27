import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { GenericAuthForm } from '@/components/Auth/GenericForm'
import { signUp } from '@/lib/auth-client'
import { useAuthStore } from '@/store/auth'

export const Route = createFileRoute('/auth/sign-up')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({
        to: '/'
      })
    }
  },
  component: SignUpPage
})

function SignUpPage() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const navigate = Route.useNavigate()
  const { setUser } = useAuthStore()

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const name = formData.get('name') as string
    const username = formData.get('username') as string

    try {
      const result = await signUp.email({
        email,
        password,
        name,
        username
      })

      if (result.data) {
        setMessage('Sign up successful! Redirecting to home...')
        setError('')
        setUser(result.data.user)
        setTimeout(() => {
          navigate({ to: '/' })
        }, 1500)
      } else if (result.error) {
        setError(result.error.message || 'Failed to sign up')
        setMessage('')
      }
    } catch (_err) {
      setError('Failed to sign up')
      setMessage('')
    }
  }

  return (
    <div className=''>
      <div className='mx-auto space-y-8 w-full max-w-md'>
        {message && (
          <div className='p-4 text-sm text-green-700 bg-green-100 rounded-md'>
            {message}
          </div>
        )}
        {error && (
          <div className='p-4 text-sm text-red-700 bg-red-100 rounded-md'>
            {error}
          </div>
        )}
        <GenericAuthForm
          formTitle='Sign Up'
          fields={[
            {
              name: 'email',
              label: 'Email',
              type: 'email',
              placeholder: 'name@example.com',
              required: true
            },
            {
              name: 'name',
              label: 'Name',
              type: 'text',
              placeholder: 'Enter your name',
              required: true
            },
            {
              name: 'username',
              label: 'Username',
              type: 'text',
              placeholder: 'Choose a username',
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
          submitButtonText='Sign Up'
        />
        <div className='text-center'>
          <p className='text-sm text-gray-500'>
            Already have an account? <Link to='/auth/sign-in'>Sign in</Link>
          </p>
          <p className='text-sm text-gray-500'>
            Forgot password? <Link to='/auth/forgot-password'>Reset here</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default SignUpPage
