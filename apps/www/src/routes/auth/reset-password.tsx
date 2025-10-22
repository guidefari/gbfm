import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { GenericAuthForm } from '@/components/Auth/GenericForm'
import { VPS_BASE_URL } from '@/lib/http'

export const searchSchema = z.object({
  token: z.string(),
  email: z.email()
})

export const Route = createFileRoute('/auth/reset-password')({
  component: ResetPasswordPage,
  validateSearch: zodValidator(searchSchema)
})

function ResetPasswordPage() {
  const { token, email } = Route.useSearch()
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isValidToken, setIsValidToken] = useState<boolean>(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.')
      return
    }
    setIsValidToken(true)
  }, [token])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      const response = await fetch(`${VPS_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          password,
          email
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(
          'Password reset successful! You can now log in with your new password.'
        )
        setTimeout(() => {
          window.location.href = '/auth/signin'
        }, 1500)
        setError('')
      } else {
        setError(data.error || 'Failed to reset password')
        setMessage('')
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
