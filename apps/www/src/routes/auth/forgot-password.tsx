import { getFormString } from '@gbfm/core/utils'
import { GenericAuthForm } from '@gbfm/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { AuthPageLayout, AuthStatusNotice } from '@/components/Auth/AuthPageLayout'
import { authClient } from '@/lib/auth-client'
import { useCooldown } from '@/lib/useCooldown'

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordPage
})

const RESEND_COOLDOWN_SECONDS = 30

function ForgotPasswordPage() {
  const [error, setError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sentEmail, setSentEmail] = useState<string>('')
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS)

  const sendReset = async (email: string) => {
    setIsSubmitting(true)
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      if (result.error) {
        setError(result.error.message || 'Failed to send reset email')
      } else {
        setError('')
        setSentEmail(email)
        cooldown.start()
      }
    } catch (_err) {
      setError('Failed to send reset email')
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = getFormString(formData, 'email')
    await sendReset(email)
  }

  const onResend = () => {
    if (cooldown.isActive || !sentEmail) return
    void sendReset(sentEmail)
  }

  const useDifferentEmail = () => {
    setSentEmail('')
    setError('')
    cooldown.reset()
  }

  const isSent = Boolean(sentEmail)

  return (
    <AuthPageLayout
      badge={isSent ? 'Email Sent' : 'Password Help'}
      title={isSent ? 'Check your inbox.' : 'Reset your password.'}
      description={
        isSent
          ? "We sent a reset link. It should arrive in a minute. If you don't see it, check spam."
          : 'Enter the email tied to your account and we will send you a reset link.'
      }
      status={
        !isSent && error ? <AuthStatusNotice variant='error'>{error}</AuthStatusNotice> : null
      }
      footer={
        <div className='space-y-3 border-t border-gb-pastel-green-2/20 pt-4 text-base text-muted-foreground'>
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
      {isSent ? (
        <div className='space-y-5'>
          <div className='flex flex-col items-center gap-3 border border-gb-pastel-green-2/30 bg-gb-pastel-green-2/10 px-6 py-8 text-center'>
            <MailCheck className='h-10 w-10 text-gb-pastel-green-1' />
            <p className='text-base text-muted-foreground'>Reset link sent to</p>
            <p className='text-base font-semibold break-all text-foreground'>{sentEmail}</p>
          </div>

          {error ? <AuthStatusNotice variant='error'>{error}</AuthStatusNotice> : null}

          <div className='space-y-2 text-base'>
            <p className='text-muted-foreground'>Didn&apos;t get the email?</p>
            <div className='flex flex-wrap gap-x-4 gap-y-2'>
              <button
                type='button'
                onClick={onResend}
                disabled={cooldown.isActive || isSubmitting}
                className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:text-muted-foreground'>
                {isSubmitting
                  ? 'Resending...'
                  : cooldown.isActive
                    ? `Resend in ${cooldown.remaining}s`
                    : 'Resend email'}
              </button>
              <button
                type='button'
                onClick={useDifferentEmail}
                className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
                Use a different email
              </button>
            </div>
          </div>
        </div>
      ) : (
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
      )}
    </AuthPageLayout>
  )
}
