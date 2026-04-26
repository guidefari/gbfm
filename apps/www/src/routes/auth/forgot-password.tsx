import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  AuthPageLayout,
  AuthStatusNotice
} from '@/components/Auth/AuthPageLayout'
import { GenericAuthForm } from '@/components/Auth/GenericForm'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordPage
})

function ForgotPasswordPage() {
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      if (result.error) {
        setError(result.error.message || 'Failed to send reset email')
        setMessage('')
      } else {
        setMessage('Password reset email sent! Check your inbox.')
        setError('')
      }
    } catch (_err) {
      setError('Failed to send reset email')
      setMessage('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPageLayout
      badge='Password Help'
      title='Reset your password'
      description='Enter the email tied to your account and we will send you a reset link.'
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
            Remembered your password?{' '}
            <Link
              to='/auth/sign-in'
              className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
              Sign in
            </Link>
          </p>
          <p>
            Need an account first?{' '}
            <Link
              to='/auth/sign-up'
              className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
              Create one here
            </Link>
          </p>
        </div>
      }>
      <GenericAuthForm
        formTitle='Forgot Password'
        fields={[
          {
            name: 'email',
            label: 'Email',
            type: 'email',
            placeholder: 'name@example.com',
            required: true,
            autoComplete: 'email',
            autoFocus: true
          }
        ]}
        onSubmit={onSubmit}
        submitButtonText='Send Reset Email'
        isSubmitting={isSubmitting}
      />
    </AuthPageLayout>
  )
}
