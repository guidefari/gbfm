import { Button, Input } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle, Loader2, Mail, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useNewsletterUnsubscribe, useRequestNewsletterUnsubscribe } from '@/lib/http'

const searchSchema = z.object({
  token: z.string().optional()
})

export const Route = createFileRoute('/unsubscribe')({
  component: Unsubscribe,
  validateSearch: searchSchema
})

function Unsubscribe() {
  const { token } = Route.useSearch()

  if (token) {
    return <UnsubscribeWithToken token={token} />
  }

  return <RequestUnsubscribeForm />
}

function UnsubscribeWithToken({ token }: { token: string }) {
  const { mutate, isPending, isSuccess, isError } = useNewsletterUnsubscribe()

  useEffect(() => {
    mutate({ token })
  }, [token, mutate])

  return (
    <section className='max-w-2xl mx-auto px-4 py-20'>
      <div className='flex flex-col items-center gap-4 p-6 rounded-lg bg-muted/50'>
        {isPending && <Loader2 className='w-12 h-12 animate-spin text-muted-foreground' />}
        {isSuccess && (
          <>
            <CheckCircle className='w-12 h-12 text-green-500' />
            <div className='text-center'>
              <p className='font-medium text-lg'>Unsubscribed</p>
              <p className='text-sm text-muted-foreground mt-1'>
                You've been removed from the mailing list.
              </p>
            </div>
          </>
        )}
        {isError && (
          <>
            <XCircle className='w-12 h-12 text-destructive' />
            <div className='text-center'>
              <p className='font-medium text-lg'>Something went wrong</p>
              <p className='text-sm text-muted-foreground mt-1'>
                This link may have already been used or is invalid.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function RequestUnsubscribeForm() {
  const [email, setEmail] = useState('')
  const { mutate, isPending, isSuccess, isError } = useRequestNewsletterUnsubscribe()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) {
      mutate({ email: email.trim() })
    }
  }

  return (
    <section className='max-w-2xl mx-auto px-4 py-20'>
      <div className='text-center mb-8'>
        <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-6'>
          <Mail className='w-8 h-8 text-foreground/70' />
        </div>
        <h1 className='text-3xl font-bold mb-3'>Unsubscribe</h1>
        <p className='text-muted-foreground'>
          Enter your email and we'll send you an unsubscribe link.
        </p>
      </div>

      {isSuccess ? (
        <div className='flex flex-col items-center gap-4 p-6 rounded-lg bg-muted/50'>
          <CheckCircle className='w-12 h-12 text-green-500' />
          <div className='text-center'>
            <p className='font-medium text-lg'>Check your inbox</p>
            <p className='text-sm text-muted-foreground mt-1'>
              If that address is on the list, we've sent an unsubscribe link.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className='flex flex-col sm:flex-row gap-3'>
          <Input
            type='email'
            name='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder='Enter your email'
            required
            disabled={isPending}
            className='flex-1'
          />
          <Button type='submit' disabled={isPending || !email.trim()}>
            {isPending ? (
              <>
                <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                Sending...
              </>
            ) : (
              'Send link'
            )}
          </Button>
        </form>
      )}

      {isError && (
        <p className='text-sm text-destructive mt-3 text-center'>
          Something went wrong. Please try again.
        </p>
      )}
    </section>
  )
}
