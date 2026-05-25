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
    <section className='mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24'>
      <div className='border border-border/60 bg-card/70 shadow-2xl backdrop-blur-sm'>
        <div className='flex flex-col gap-8 p-6 sm:p-10'>
          <div className='text-center'>
            <div className='mb-6 inline-flex h-16 w-16 items-center justify-center border border-border/70 bg-muted/50'>
              <Mail className='h-8 w-8 text-primary' />
            </div>
            <p className='mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-primary/80'>
              Newsletter
            </p>
            <h1 className='mb-3 text-3xl font-bold tracking-tight sm:text-4xl'>
              Stay in the loop
            </h1>
            <p className='mx-auto max-w-xl text-sm text-muted-foreground sm:text-base'>
              Get notified when new mixes drop and other goosebumps updates.
            </p>
          </div>

          {isSuccess ? (
            <div className='flex flex-col items-center gap-4 border border-green-500/30 bg-green-500/10 p-6 text-center'>
              <CheckCircle className='h-12 w-12 text-green-500' />
              <div>
                <p className='text-lg font-medium'>
                  {data?.subscribed
                    ? "You're subscribed!"
                    : "You're already subscribed!"}
                </p>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {data?.subscribed
                    ? `We'll send updates to ${data.email}`
                    : `${data?.email} is already on the list.`}
                </p>
              </div>
            </div>
          ) : (
            <div className='border border-border/60 bg-background/30 p-4 sm:p-5'>
              <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
                <div className='grid gap-3 lg:grid-cols-[0.9fr_1.3fr_auto]'>
                  <Input
                    type='text'
                    name='name'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder='Your name (optional)'
                    disabled={isPending}
                    className='h-11 border-border/70 bg-background/60 px-4'
                  />
                  <Input
                    type='email'
                    name='email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder='Enter your email'
                    required
                    disabled={isPending}
                    className='h-11 border-border/70 bg-background/60 px-4'
                  />
                  <Button
                    type='submit'
                    disabled={isPending || !email.trim()}
                    className='h-11 shrink-0 px-6 font-semibold uppercase tracking-[0.18em] lg:self-stretch'>
                    {isPending ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Subscribing...
                      </>
                    ) : (
                      'Subscribe'
                    )}
                  </Button>
                </div>
                <p className='text-center text-xs text-muted-foreground'>
                  No spam. Just new mixes, notable drops, and occasional
                  updates.
                </p>
              </form>
            </div>
          )}

          {isError && (
            <p className='text-center text-sm text-destructive'>
              {error?.message || 'Something went wrong. Please try again.'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
