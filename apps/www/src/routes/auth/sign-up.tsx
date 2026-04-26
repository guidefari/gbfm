import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import {
  AuthPageLayout,
  AuthStatusNotice
} from '@/components/Auth/AuthPageLayout'
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = Route.useNavigate()
  const { setUser } = useAuthStore()

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
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
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPageLayout
      badge='Create Account'
      title='Create your listener account'
      description='Save favorites, follow the people you love, and keep your place in the archive.'
      status={
        message ? (
          <AuthStatusNotice variant='success'>{message}</AuthStatusNotice>
        ) : error ? (
          <AuthStatusNotice variant='error'>{error}</AuthStatusNotice>
        ) : null
      }
      footer={
        <div className='space-y-3 border-t border-gb-pastel-green-2/20 pt-4 text-sm text-muted-foreground'>
          <p>
            Already have an account?{' '}
            <Link
              to='/auth/sign-in'
              className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
              Sign in
            </Link>
          </p>
          <p>
            Forgot password?{' '}
            <Link
              to='/auth/forgot-password'
              className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
              Reset it here
            </Link>
          </p>
        </div>
      }>
      <GenericAuthForm
        formTitle='Sign Up'
        fields={[
          {
            name: 'email',
            label: 'Email',
            type: 'email',
            placeholder: 'name@example.com',
            required: true,
            autoComplete: 'email',
            autoFocus: true
          },
          {
            name: 'name',
            label: 'Name',
            type: 'text',
            placeholder: 'Enter your name',
            required: true,
            autoComplete: 'name'
          },
          {
            name: 'username',
            label: 'Username',
            type: 'text',
            placeholder: 'Choose a username',
            required: true,
            autoComplete: 'username',
            helperText:
              'Keep it short and recognizable. This becomes part of your public profile.'
          },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            placeholder: 'Enter your password',
            required: true,
            autoComplete: 'new-password'
          }
        ]}
        onSubmit={onSubmit}
        submitButtonText='Sign Up'
        isSubmitting={isSubmitting}
      />
    </AuthPageLayout>
  )
}

export default SignUpPage
