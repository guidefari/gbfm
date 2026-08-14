import { getFormString } from '@gbfm/core/utils'
import { GenericAuthForm, toast } from '@gbfm/ui'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { AuthPageLayout, AuthStatusNotice } from '@/components/Auth/AuthPageLayout'
import { signIn } from '@/lib/auth-client'

const searchSchema = z.object({
  redirect: z.string().optional()
})

const safeRedirect = (target: string | undefined) =>
  target && target.startsWith('/') && !target.startsWith('//') ? target : '/'

export const Route = createFileRoute('/auth/sign-in')({
  validateSearch: searchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      // href, not to: the target is a runtime string that may carry its own search params, and
      // resolving it as a route template drops them.
      throw redirect({ href: safeRedirect(search.redirect) })
    }
  },
  component: SignInPage
})

function SignInPage() {
  const [error, setError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const identifier = getFormString(formData, 'identifier')
    const password = getFormString(formData, 'password')

    try {
      const isEmail = identifier.includes('@')
      const result = isEmail
        ? await signIn.email({ email: identifier, password })
        : await signIn.username({ username: identifier, password })

      if (result.data) {
        toast({
          title: 'Sign in successful!',
          description: 'Redirecting to home page...',
          variant: 'default'
        })
        setError('')
        void navigate({ href: safeRedirect(search.redirect) })
      } else if (result.error) {
        setError(result.error.message || 'Failed to sign in')
      }
    } catch (_err) {
      setError('Failed to sign in')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPageLayout
      badge='Sign In'
      title='Welcome back.'
      description='Sign in to pick up where you left off.'
      status={error ? <AuthStatusNotice variant='error'>{error}</AuthStatusNotice> : null}
      footer={
        <div className='space-y-3 border-t border-gb-pastel-green-2/20 pt-4 text-base text-muted-foreground'>
          <p>
            Don&apos;t have an account?{' '}
            <Link
              to='/auth/sign-up'
              className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
              Sign up
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
        formTitle='Sign In'
        fields={[
          {
            name: 'identifier',
            label: 'Email or Username',
            type: 'text',
            placeholder: 'name@example.com or username',
            required: true,
            autoComplete: 'username',
            autoFocus: true
          },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            placeholder: 'Enter your password',
            required: true,
            autoComplete: 'current-password'
          }
        ]}
        onSubmit={onSubmit}
        submitButtonText='Sign In'
        isSubmitting={isSubmitting}
      />
    </AuthPageLayout>
  )
}
