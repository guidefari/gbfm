import { Button, Input } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle, Loader2, Mail } from 'lucide-react'
import { useState } from 'react'
import { useNewsletterSubscribe } from '@/lib/http'

export const Route = createFileRoute('/subscribe')({
  component: Subscribe
})

function Subscribe() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const { mutate, isPending, isSuccess, isError, error, data } =
    useNewsletterSubscribe()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) {
      mutate({ email: email.trim(), name: name.trim() || undefined })
    }
  }

  return (
    <section className='max-w-2xl mx-auto px-4 py-20'>
      <div className='text-center mb-8'>
        <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-6'>
          <Mail className='w-8 h-8 text-foreground/70' />
        </div>
        <h1 className='text-3xl font-bold mb-3'>Stay in the loop</h1>
        <p className='text-muted-foreground'>
          Get notified when new mixes drop and other goosebumps updates.
        </p>
      </div>

      {isSuccess ? (
        <div className='flex flex-col items-center gap-4 p-6 rounded-lg bg-muted/50'>
          <CheckCircle className='w-12 h-12 text-green-500' />
          <div className='text-center'>
            <p className='font-medium text-lg'>
              {data?.subscribed
                ? "You're subscribed!"
                : "You're already subscribed!"}
            </p>
            <p className='text-sm text-muted-foreground mt-1'>
              {data?.subscribed
                ? `We'll send updates to ${data.email}`
                : `${data?.email} is already on the list.`}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
          <Input
            type='text'
            name='name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Your name (optional)'
            disabled={isPending}
          />
          <div className='flex flex-col sm:flex-row gap-3'>
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
                  Subscribing...
                </>
              ) : (
                'Subscribe'
              )}
            </Button>
          </div>
        </form>
      )}

      {isError && (
        <p className='text-sm text-destructive mt-3 text-center'>
          {error?.message || 'Something went wrong. Please try again.'}
        </p>
      )}
    </section>
  )
}
