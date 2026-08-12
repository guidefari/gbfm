import { MailWarning, X } from 'lucide-react'
import { useState } from 'react'
import { authClient, useSession } from '@/lib/auth-client'
import { useCooldown } from '@/lib/useCooldown'

const RESEND_COOLDOWN_SECONDS = 30
const DISMISS_KEY = 'verify-email-banner-dismissed'

export function VerifyEmailBanner() {
  const { data: session } = useSession()
  const user = session?.user
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!('window' in globalThis)) return false
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  })
  const [isResending, setIsResending] = useState(false)
  const [message, setMessage] = useState('')
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS)

  if (!user || user.emailVerified || dismissed) return null

  const onResend = async () => {
    if (cooldown.isActive || isResending) return
    setIsResending(true)
    setMessage('')
    try {
      const { error } = await authClient.sendVerificationEmail({
        email: user.email
      })
      if (error) {
        setMessage(error.message || 'Failed to resend.')
      } else {
        setMessage('Sent. Check your inbox.')
        cooldown.start()
      }
    } catch {
      setMessage('Failed to resend.')
    } finally {
      setIsResending(false)
    }
  }

  const onDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className='sticky top-0 z-40 flex items-center gap-3 border-b border-gb-pastel-green-2/30 bg-gb-pastel-green-2/10 px-4 py-2 text-base text-foreground backdrop-blur'>
      <MailWarning className='h-4 w-4 shrink-0 text-gb-pastel-green-1' />
      <p className='flex-1'>
        Verify your email to unlock everything.{' '}
        <button
          type='button'
          onClick={onResend}
          disabled={cooldown.isActive || isResending}
          className='font-medium text-gb-pastel-green-1 underline underline-offset-4 hover:text-gb-highlight disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline'>
          {isResending
            ? 'Sending...'
            : cooldown.isActive
              ? `Resend in ${cooldown.remaining}s`
              : 'Resend email'}
        </button>
        {message ? <span className='ml-2 text-muted-foreground'>{message}</span> : null}
      </p>
      <button
        type='button'
        onClick={onDismiss}
        aria-label='Dismiss'
        className='shrink-0 text-muted-foreground hover:text-foreground'>
        <X className='h-4 w-4' />
      </button>
    </div>
  )
}
