import { Button, Card, CardContent, CardHeader, CardTitle } from '@gbfm/ui'
import { useState } from 'react'
import { requestPasswordReset } from '@/lib/auth-client'

interface ChangePasswordCardProps {
  email: string
}

export function ChangePasswordCard({ email }: ChangePasswordCardProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  )

  const handleRequest = async () => {
    setStatus('sending')
    try {
      const result = await requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      if (result.error) {
        setStatus('error')
      } else {
        setStatus('sent')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <p className='text-sm text-muted-foreground'>
          We'll send a password reset link to{' '}
          <span className='font-medium text-foreground'>{email}</span>.
        </p>
        {status === 'sent' ? (
          <p className='text-sm text-gb-pastel-green-1 font-medium'>
            Reset link sent — check your inbox.
          </p>
        ) : status === 'error' ? (
          <p className='text-sm text-destructive'>
            Something went wrong. Try again.
          </p>
        ) : null}
        <Button
          type='button'
          variant='outline'
          onClick={handleRequest}
          disabled={status === 'sending' || status === 'sent'}>
          {status === 'sending'
            ? 'Sending...'
            : status === 'sent'
              ? 'Link Sent'
              : 'Send Reset Link'}
        </Button>
      </CardContent>
    </Card>
  )
}
