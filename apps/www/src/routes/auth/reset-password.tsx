import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { GenericAuthForm } from '@/components/Auth/GenericForm'
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
    const formData = new FormData(event.currentTarget)
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!search.token) {
      setError('Invalid reset token')
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
    }
  }

  if (!isValidToken) {
    return (
      <div className='flex min-h-[65dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8'>
        <div className='w-full max-w-md mx-auto space-y-8'>
          <div className='p-4 text-sm text-red-700 bg-red-100 rounded-md'>
            {error}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='flex min-h-[65dvh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8'>
      <div className='w-full max-w-md mx-auto space-y-8'>
        <div className='flex flex-col items-center justify-center space-y-2'>
          <div className='inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-primary text-primary-foreground'>
            Reset Password
          </div>
        </div>

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
          formTitle='Reset Password'
          fields={[
            {
              name: 'password',
              label: 'New Password',
              type: 'password',
              placeholder: 'Enter new password',
              required: true
            },
            {
              name: 'confirmPassword',
              label: 'Confirm Password',
              type: 'password',
              placeholder: 'Confirm new password',
              required: true
            }
          ]}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  )
}
