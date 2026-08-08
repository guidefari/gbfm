import { Dialog, DialogContent, DialogTitle, Input } from '@gbfm/ui'
import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { GlobalSearchResultRow } from '@/components/GlobalSearchResultRow'
import { useGlobalSearch } from '@/lib/http'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const groups = [
  { key: 'shows', label: 'Shows' },
  { key: 'audio', label: 'Mixes' },
  { key: 'posts', label: 'Posts' }
] as const

export function GlobalSearchDialog({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, isPending } = useGlobalSearch(query)
  const showResults = query.trim().length > 0
  const totalResults = data ? groups.reduce((sum, g) => sum + data[g.key].length, 0) : 0

  useEffect(() => {
    if (open) inputRef.current?.focus()
    else setQuery('')
  }, [open])

  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='top-[20%] max-w-lg translate-y-0 gap-3 p-4 pt-12'>
        <DialogTitle className='sr-only'>Search</DialogTitle>
        <div className='relative flex items-center'>
          <Search className='pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60' />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search shows, mixes, tweets, editorial...'
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
          <div className='max-h-96 overflow-y-auto rounded-sm border border-border/60'>
            {isPending ? (
              <p className='px-3 py-3 text-base text-muted-foreground'>Searching...</p>
            ) : totalResults === 0 ? (
              <p className='px-3 py-3 text-base text-muted-foreground'>No matches.</p>
            ) : (
              groups.map(
                (group) =>
                  data &&
                  data[group.key].length > 0 && (
                    <div key={group.key}>
                      <div className='bg-muted/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
                        {group.label}
                      </div>
                      {data[group.key].map((result) => (
                        <GlobalSearchResultRow key={result.id} result={result} onClick={close} />
                      ))}
                    </div>
                  )
              )
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
