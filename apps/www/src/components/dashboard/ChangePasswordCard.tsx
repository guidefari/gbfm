import { Button, Card, CardContent, CardHeader, CardTitle, useToast } from '@gbfm/ui'
import { useState } from 'react'
import { requestPasswordReset } from '@/lib/auth-client'

interface ChangePasswordCardProps {
  email: string
}

export function ChangePasswordCard({ email }: ChangePasswordCardProps) {
  const [isSending, setIsSending] = useState(false)
  const { toast } = useToast()

  const handleRequest = async () => {
    setIsSending(true)
    try {
      const result = await requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Failed to send reset link',
          description: 'Please try again later.'
        })
      } else {
        toast({ title: 'Reset link sent', description: 'Check your inbox.' })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to send reset link',
        description: 'Please try again later.'
      })
    } finally {
      setIsSending(false)
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
        <Button type='button' variant='outline' onClick={handleRequest} disabled={isSending}>
          {isSending ? 'Sending...' : 'Send Reset Link'}
        </Button>
      </CardContent>
    </Card>
  )
}
