import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import { z } from 'zod'
import { useNewsletterUnsubscribe } from '@/lib/http'

const searchSchema = z.object({
  token: z.string().optional()
})

export const Route = createFileRoute('/unsubscribe')({
  component: Unsubscribe,
  validateSearch: searchSchema
})

function Unsubscribe() {
  const { token } = Route.useSearch()
  const { mutate, isPending, isSuccess, isError } = useNewsletterUnsubscribe()

  useEffect(() => {
    if (token) {
      mutate({ token })
    }
  }, [token, mutate])

  if (!token) {
    return (
      <section className='max-w-2xl mx-auto px-4 py-20 text-center'>
        <p className='text-muted-foreground'>Invalid unsubscribe link.</p>
      </section>
    )
  }

  return (
    <section className='max-w-2xl mx-auto px-4 py-20'>
      <div className='flex flex-col items-center gap-4 p-6 rounded-lg bg-muted/50'>
        {isPending && (
          <Loader2 className='w-12 h-12 animate-spin text-muted-foreground' />
        )}
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
