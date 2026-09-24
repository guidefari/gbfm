import { Loader2, MessageSquareQuote } from 'lucide-react'

export function QuotedTweet({
  slug,
  isPending,
  title,
  content
}: {
  slug: string | null
  isPending: boolean
  title: string | null | undefined
  content: string | null | undefined
}) {
  if (!slug) return null
  return (
    <div className='border-t border-gb-pastel-green-2/15 pt-4'>
      <div className='flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground'>
        <MessageSquareQuote className='size-3.5' />
        Quoted tweet
      </div>
      {isPending ? (
        <div className='mt-2 flex items-center gap-2 text-xs text-muted-foreground'>
          <Loader2 className='size-3.5 animate-spin' />
          Resolving quoted tweet…
        </div>
      ) : title || content ? (
        <div className='mt-2 flex items-center gap-3 border border-gb-pastel-green-2/15 bg-black/20 p-2.5'>
          <MessageSquareQuote className='size-4 shrink-0 text-muted-foreground' />
          <div className='min-w-0 flex-1 truncate text-base text-muted-foreground'>
            {title || content}
          </div>
        </div>
      ) : (
        <p className='mt-2 text-xs text-muted-foreground'>
          Paste a tweet link in the commentary to auto-attach it as a quote.
        </p>
      )}
    </div>
  )
}
