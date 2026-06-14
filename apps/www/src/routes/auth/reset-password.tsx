import { getFormString } from '@gbfm/core/utils'
import { GenericAuthForm, isPasswordValid, PasswordChecklist } from '@gbfm/ui'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { AuthPageLayout, AuthStatusNotice } from '@/components/Auth/AuthPageLayout'
import { useSession } from '@/lib/auth-client'
import { apiUrl } from '@/lib/http'
import { readResponseErrorMessage } from '@/lib/response'

export const searchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional()
})

export const Route = createFileRoute('/auth/reset-password')({
  component: ResetPasswordPage,
  validateSearch: searchSchema
})

async function confirmInvite(token: string, password: string) {
  const res = await fetch(apiUrl('/invite/confirm'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, password })
  })
  if (!res.ok) {
    throw new Error(await readResponseErrorMessage(res, 'Failed to reset password'))
  }
}

function ResetPasswordPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { refetch: refetchSession } = useSession()
  const [password, setPassword] = useState('')

  const isValidToken = !search.error && Boolean(search.token)

  const { mutate, isPending, isSuccess, error } = useMutation({
    mutationFn: ({ password }: { password: string }) => {
      if (!search.token) {
        throw new Error('Missing reset token')
      }

      return confirmInvite(search.token, password)
    },
    onSuccess: async () => {
      await refetchSession()
      navigate({ to: '/' })
    }
  })

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const password = getFormString(formData, 'password')
    const confirmPassword = getFormString(formData, 'confirmPassword')

    if (!isPasswordValid(password)) return
    if (password !== confirmPassword) return
    if (!search.token) return

    mutate({ password })
  }

  if (!isValidToken) {
    return (
      <AuthPageLayout
        badge='Reset Link'
        title='That reset link is no longer valid'
        description='Request a fresh password reset email and we will help you back in.'
        status={
          search.error ? (
            <AuthStatusNotice variant='error'>
              Invalid or expired reset link. Please request a new password reset.
            </AuthStatusNotice>
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
          Reset links expire for safety. If the email is still in your inbox, the newest link is the
          one to use.
        </div>
      </AuthPageLayout>
    )
  }

  return (
    <AuthPageLayout
      badge='Reset Password'
      title='Choose a new password'
      description='Set a fresh password for your account and we will log you straight in.'
      status={
        isSuccess ? (
          <AuthStatusNotice variant='success'>Password set! Taking you in...</AuthStatusNotice>
        ) : error ? (
          <AuthStatusNotice variant='error'>{error.message}</AuthStatusNotice>
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
        isSubmitting={isPending}
        submitDisabled={!isPasswordValid(password)}
      />
    </AuthPageLayout>
  )
}
