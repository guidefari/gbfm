import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import {
  AuthPageLayout,
  AuthStatusNotice
} from '@/components/Auth/AuthPageLayout'
import { GenericAuthForm } from '@/components/Auth/GenericForm'
import {
  isPasswordValid,
  PasswordChecklist
} from '@/components/Auth/PasswordChecklist'
import { authClient } from '@/lib/auth-client'

export const searchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional()
})

export const Route = createFileRoute('/auth/reset-password')({
  component: ResetPasswordPage,
  validateSearch: searchSchema
})

function ResetPasswordPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isValidToken, setIsValidToken] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (search.error) {
      setError(
        'Invalid or expired reset link. Please request a new password reset.'
      )
      return
    }
    if (!search.token) {
      setError('Invalid reset link. Please request a new password reset.')
      return
    }
    setIsValidToken(true)
  }, [search.token, search.error])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!isPasswordValid(password)) {
      setError('Password does not meet requirements')
      setIsSubmitting(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsSubmitting(false)
      return
    }

    if (!search.token) {
      setError('Invalid reset token')
      setIsSubmitting(false)
      return
    }

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token: search.token
      })

      if (result.error) {
        setError(result.error.message || 'Failed to reset password')
        setMessage('')
      } else {
        setMessage(
          'Password reset successful! You can now log in with your new password.'
        )
        setError('')
        setTimeout(() => {
          navigate({ to: '/auth/sign-in' })
        }, 1500)
      }
    } catch (_err) {
      setError('Failed to reset password')
      setMessage('')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isValidToken) {
    return (
      <AuthPageLayout
        badge='Reset Link'
        title='That reset link is no longer valid'
        description='Request a fresh password reset email and we will help you back in.'
        status={
          error ? (
            <AuthStatusNotice variant='error'>{error}</AuthStatusNotice>
          ) : null
        }
        footer={
          <div className='space-y-3 border-t border-gb-pastel-green-2/20 pt-4 text-sm text-muted-foreground'>
            <p>
              Need a new link?{' '}
              <Link
                to='/auth/forgot-password'
                className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
                Request another reset email
              </Link>
            </p>
          </div>
        }>
        <div className='border border-gb-pastel-green-2/20 bg-background/50 px-4 py-4 text-sm leading-6 text-muted-foreground'>
          Reset links expire for safety. If the email is still in your inbox,
          the newest link is the one to use.
        </div>
      </AuthPageLayout>
    )
  }

  return (
    <AuthPageLayout
      badge='Reset Password'
      title='Choose a new password'
      description='Set a fresh password for your account and we will send you back to sign in.'
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
            Remembered it after all?{' '}
            <Link
              to='/auth/sign-in'
              className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
              Sign in instead
            </Link>
          </p>
        </div>
      }>
      <GenericAuthForm
        formTitle='Reset Password'
        fields={[
          {
            name: 'password',
            label: 'New Password',
            type: 'password',
            placeholder: 'Enter new password',
            required: true,
            autoComplete: 'new-password',
            autoFocus: true,
            onChange: setPassword,
            belowField: <PasswordChecklist password={password} />
          },
          {
            name: 'confirmPassword',
            label: 'Confirm Password',
            type: 'password',
            placeholder: 'Confirm new password',
            required: true,
            autoComplete: 'new-password'
          }
        ]}
        onSubmit={onSubmit}
        submitButtonText='Reset Password'
        isSubmitting={isSubmitting}
        submitDisabled={!isPasswordValid(password)}
      />
    </AuthPageLayout>
  )
}
