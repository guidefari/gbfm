import {
  GenericAuthForm,
  isPasswordValid,
  PasswordChecklist,
  ProfilePreviewCard
} from '@gbfm/ui'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import {
  AuthPageLayout,
  AuthStatusNotice
} from '@/components/Auth/AuthPageLayout'
import { TermsConsent } from '@/components/Auth/TermsConsent'
import {
  UsernameAvailability,
  useUsernameAvailability
} from '@/components/Auth/UsernameAvailability'
import { authClient, signUp } from '@/lib/auth-client'
import { useCooldown } from '@/lib/useCooldown'

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

const RESEND_COOLDOWN_SECONDS = 30

function SignUpPage() {
  const [error, setError] = useState('')
  const [errorIsExistingEmail, setErrorIsExistingEmail] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [signedUpEmail, setSignedUpEmail] = useState('')
  const [resendError, setResendError] = useState('')
  const [isResending, setIsResending] = useState(false)
  const usernameStatus = useUsernameAvailability(username)
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS)

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
        setError('')
        setErrorIsExistingEmail(false)
        setSignedUpEmail(email)
        cooldown.start()
      } else if (result.error) {
        const msg = result.error.message || 'Failed to sign up'
        setError(msg)
        setErrorIsExistingEmail(isExistingEmailError(msg))
      }
    } catch (_err) {
      setError('Failed to sign up')
      setErrorIsExistingEmail(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const onResend = async () => {
    if (cooldown.isActive || !signedUpEmail) return
    setIsResending(true)
    setResendError('')
    try {
      const { error } = await authClient.sendVerificationEmail({
        email: signedUpEmail
      })
      if (error) {
        setResendError(error.message || 'Failed to resend.')
      } else {
        cooldown.start()
      }
    } catch {
      setResendError('Failed to resend.')
    } finally {
      setIsResending(false)
    }
  }

  const isSent = Boolean(signedUpEmail)

  return (
    <AuthPageLayout
      badge={isSent ? 'Check your inbox' : 'Create Account'}
      title={isSent ? 'Almost there.' : 'Create your listener account'}
      description={
        isSent
          ? 'We sent a verification link. Click it to confirm your email and finish setting up.'
          : 'Save favorites, follow the people you love, and keep your place in the archive.'
      }
      aside={
        isSent ? null : (
          <ProfilePreviewCard displayName={displayName} username={username} />
        )
      }
      status={
        !isSent && error ? (
          <AuthStatusNotice variant='error'>
            {error}
            {errorIsExistingEmail ? (
              <>
                {' '}
                <Link
                  to='/auth/sign-in'
                  className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
                  Sign in instead
                </Link>
              </>
            ) : null}
          </AuthStatusNotice>
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
          {!isSent ? (
            <p>
              Forgot password?{' '}
              <Link
                to='/auth/forgot-password'
                className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
                Reset it here
              </Link>
            </p>
          ) : null}
        </div>
      }>
      {isSent ? (
        <div className='space-y-5'>
          <div className='flex flex-col items-center gap-3 border border-gb-pastel-green-2/30 bg-gb-pastel-green-2/10 px-6 py-8 text-center'>
            <MailCheck className='h-10 w-10 text-gb-pastel-green-1' />
            <p className='text-sm text-muted-foreground'>
              Verification email sent to
            </p>
            <p className='text-base font-semibold break-all text-foreground'>
              {signedUpEmail}
            </p>
          </div>

          {resendError ? (
            <AuthStatusNotice variant='error'>{resendError}</AuthStatusNotice>
          ) : null}

          <div className='space-y-2 text-sm'>
            <p className='text-muted-foreground'>
              Didn&apos;t get the email? Check spam, or resend.
            </p>
            <button
              type='button'
              onClick={onResend}
              disabled={cooldown.isActive || isResending}
              className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:text-muted-foreground'>
              {isResending
                ? 'Resending...'
                : cooldown.isActive
                  ? `Resend in ${cooldown.remaining}s`
                  : 'Resend email'}
            </button>
          </div>
        </div>
      ) : (
        <div className='space-y-4'>
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
                label: 'Display Name',
                type: 'text',
                placeholder: 'How you want to be known',
                required: true,
                autoComplete: 'name',
                onChange: setDisplayName
              },
              {
                name: 'username',
                label: 'Username',
                type: 'text',
                placeholder: 'yourname',
                required: true,
                autoComplete: 'username',
                onChange: setUsername,
                rightSlot: <UsernameAvailability username={username} />
              },
              {
                name: 'password',
                label: 'Password',
                type: 'password',
                placeholder: 'Enter your password',
                required: true,
                autoComplete: 'new-password',
                onChange: setPassword,
                belowField: <PasswordChecklist password={password} />
              }
            ]}
            onSubmit={onSubmit}
            submitButtonText='Sign Up'
            isSubmitting={isSubmitting}
            submitDisabled={
              !isPasswordValid(password) || usernameStatus.state === 'taken'
            }
            beforeSubmit={<TermsConsent />}
          />
        </div>
      )}
    </AuthPageLayout>
  )
}

function isExistingEmailError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('already') ||
    m.includes('exists') ||
    m.includes('in use') ||
    m.includes('taken')
  )
}

export default SignUpPage
