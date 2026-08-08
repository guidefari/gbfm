import { Dialog, DialogContent, DialogTitle, Input } from '@gbfm/ui'
import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { TweetSearchResultRow } from '@/components/TweetSearchResultRow'
import { useMicroPostSearch } from '@/lib/http'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TweetSearchDialog({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useMicroPostSearch(query)
  const showResults = query.trim().length > 0

  useEffect(() => {
    if (open) inputRef.current?.focus()
    else setQuery('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='top-[20%] max-w-lg translate-y-0 gap-3 p-4 pt-12'>
        <DialogTitle className='sr-only'>Search tweets</DialogTitle>
        <div className='relative flex items-center'>
          <Search className='pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60' />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search tweets, tracks, artists...'
            className='h-9 pl-8 pr-8 text-base'
          />
          {query && (
            <button
              type='button'
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label='Clear search'
              className='absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
              <X className='h-4 w-4' />
            </button>
          )}
        </div>

        {showResults && (
          <div className='max-h-80 overflow-y-auto rounded-sm border border-border/60'>
            {search.isPending ? (
              <p className='px-3 py-3 text-base text-muted-foreground'>Searching...</p>
            ) : search.data.length === 0 ? (
              <p className='px-3 py-3 text-base text-muted-foreground'>No matches.</p>
            ) : (
              search.data.map((result) => (
                <TweetSearchResultRow
                  key={result.id}
                  slug={result.slug}
                  title={result.title}
                  content={result.content}
                  musicEntityType={result.musicEntityType}
                  musicEntityId={result.musicEntityId}
                  onClick={() => onOpenChange(false)}
                />
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
