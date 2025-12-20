import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { GenericAuthForm } from '@/components/Auth/GenericForm'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordPage
})

function ForgotPasswordPage() {
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
    }
  }

  return (
    <div className=''>
      <div className='w-full max-w-md mx-auto space-y-8'>
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
          formTitle='I Forgot My Password'
          fields={[
            {
              name: 'email',
              label: 'Email',
              type: 'email',
              placeholder: 'name@example.com',
              required: true
            }
          ]}
          onSubmit={onSubmit}
          submitButtonText='Send Reset Email'
        />
      </div>
    </div>
  )
}
