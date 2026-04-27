import { createFileRoute, Link } from '@tanstack/react-router'
import { MailCheck } from 'lucide-react'
import { z } from 'zod'
import {
  AuthPageLayout,
  AuthStatusNotice
} from '@/components/Auth/AuthPageLayout'

const searchSchema = z.object({
  error: z.string().optional()
})

export const Route = createFileRoute('/auth/verify-email')({
  component: VerifyEmailPage,
  validateSearch: searchSchema
})

function VerifyEmailPage() {
  const { error } = Route.useSearch()
  const isError = Boolean(error)

  return (
    <AuthPageLayout
      badge={isError ? 'Verification Failed' : 'Email Verified'}
      title={isError ? "That didn't work." : "You're all set."}
      description={
        isError
          ? 'The verification link is invalid or expired. Request a new one from your account.'
          : 'Your email is verified. Welcome to goosebumps.fm.'
      }
      status={
        isError ? (
          <AuthStatusNotice variant='error'>
            {error || 'Verification failed.'}
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
      {!isError ? (
        <div className='flex flex-col items-center gap-3 border border-gb-pastel-green-2/30 bg-gb-pastel-green-2/10 px-6 py-8 text-center'>
          <MailCheck className='h-10 w-10 text-gb-pastel-green-1' />
          <p className='text-base font-semibold text-foreground'>
            Email verified
          </p>
          <p className='text-sm text-muted-foreground'>
            Thanks for confirming. Your account is fully active.
          </p>
        </div>
      ) : null}
    </AuthPageLayout>
  )
}
