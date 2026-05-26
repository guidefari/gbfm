import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Loader2, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import {
  AuthPageLayout,
  AuthStatusNotice
} from '@/components/Auth/AuthPageLayout'
import { authClient } from '@/lib/auth-client'

const searchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
  callbackURL: z.string().optional()
})

export const Route = createFileRoute('/auth/verify-email')({
  component: VerifyEmailPage,
  validateSearch: searchSchema
})

type Status = 'verifying' | 'success' | 'error'

function VerifyEmailPage() {
  const { token, error: searchError, callbackURL } = Route.useSearch()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>(
    searchError ? 'error' : token ? 'verifying' : 'error'
  )
  const [errorMessage, setErrorMessage] = useState<string>(
    searchError || (!token ? 'Missing verification token.' : '')
  )

  useEffect(() => {
    if (!token || searchError) return
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>
    ;(async () => {
      const { error } = await authClient.verifyEmail({ query: { token } })
      if (cancelled) return
      if (error) {
        setStatus('error')
        setErrorMessage(error.message || 'Verification failed.')
        return
      }
      setStatus('success')
      const redirectTo = callbackURL || '/'
      timeoutId = setTimeout(() => {
        if (redirectTo.startsWith('/')) {
          navigate({ to: redirectTo })
        } else {
          window.location.href = redirectTo
        }
      }, 1200)
    })()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [token, searchError, callbackURL, navigate])

  const isError = status === 'error'
  const isVerifying = status === 'verifying'

  return (
    <AuthPageLayout
      badge={
        isVerifying
          ? 'Verifying'
          : isError
            ? 'Verification Failed'
            : 'Email Verified'
      }
      title={
        isVerifying
          ? 'Hang tight.'
          : isError
            ? "That didn't work."
            : "You're all set."
      }
      description={
        isVerifying
          ? 'Confirming your email now.'
          : isError
            ? 'The verification link is invalid or expired. Request a new one from your account.'
            : 'Your email is verified. Signing you in.'
      }
      status={
        isError ? (
          <AuthStatusNotice variant='error'>
            {errorMessage || 'Verification failed.'}
          </AuthStatusNotice>
        ) : null
      }
      footer={
        <div className='space-y-3 border-t border-gb-pastel-green-2/20 pt-4 text-sm text-muted-foreground'>
          <p>
            <Link
              to='/'
              className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
              Head back home
            </Link>
          </p>
        </div>
      }>
      {isVerifying ? (
        <div className='flex flex-col items-center gap-3 border border-gb-pastel-green-2/30 bg-gb-pastel-green-2/10 px-6 py-8 text-center'>
          <Loader2 className='h-10 w-10 animate-spin text-gb-pastel-green-1' />
          <p className='text-base font-semibold text-foreground'>
            Verifying your email
          </p>
        </div>
      ) : !isError ? (
        <div className='flex flex-col items-center gap-3 border border-gb-pastel-green-2/30 bg-gb-pastel-green-2/10 px-6 py-8 text-center'>
          <MailCheck className='h-10 w-10 text-gb-pastel-green-1' />
          <p className='text-base font-semibold text-foreground'>
            Email verified
          </p>
          <p className='text-sm text-muted-foreground'>
            Thanks for confirming. Redirecting you now.
          </p>
        </div>
      ) : null}
    </AuthPageLayout>
  )
}
