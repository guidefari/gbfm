import { Input } from '@gbfm/ui'
import { useHotkey } from '@tanstack/react-hotkeys'
import { Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search, Shuffle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAdjacentMicroPosts, useMicroPostSearch, useRandomMicroPost } from '@/lib/http'
import { TweetSearchResultRow } from '@/components/TweetSearchResultRow'

type Props = {
  slug: string
}

const iconButtonClassName =
  'inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground'
const disabledIconButtonClassName =
  'inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground/25'

export function TweetNav({ slug }: Props) {
  const router = useRouter()
  const { data } = useAdjacentMicroPosts(slug)
  const { goToRandom } = useRandomMicroPost()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const prev = data?.prev ?? null
  const next = data?.next ?? null

  const search = useMicroPostSearch(query)
  const showResults = isSearchOpen && query.trim().length > 0

  useEffect(() => {
    if (isSearchOpen) inputRef.current?.focus()
  }, [isSearchOpen])

  const closeSearch = () => {
    setIsSearchOpen(false)
    setQuery('')
  }

  useHotkey('ArrowLeft', () => {
    if (!isSearchOpen && prev) router.navigate({ to: '/tweet/$slug', params: { slug: prev.slug } })
  })

  useHotkey('ArrowRight', () => {
    if (!isSearchOpen && next) router.navigate({ to: '/tweet/$slug', params: { slug: next.slug } })
  })

  useHotkey('Escape', () => {
    if (isSearchOpen) closeSearch()
  })

  if (isSearchOpen) {
    return (
      <div className='relative border-b border-border/40 pb-4'>
        <div className='relative flex items-center gap-2'>
          <Search className='pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60' />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search tweets, tracks, artists...'
            className='h-8 pl-8 text-sm'
          />
          <button
            type='button'
            onClick={closeSearch}
            aria-label='Close search'
            className={iconButtonClassName}>
            <X className='h-4 w-4' />
          </button>
        </div>

        {showResults && (
          <div className='absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-sm border border-border/60 bg-popover shadow-md'>
            {search.isPending ? (
              <p className='px-3 py-3 text-sm text-muted-foreground'>Searching...</p>
            ) : search.data.length === 0 ? (
              <p className='px-3 py-3 text-sm text-muted-foreground'>No matches.</p>
            ) : (
              search.data.map((result) => (
                <TweetSearchResultRow
                  key={result.id}
                  slug={result.slug}
                  title={result.title}
                  content={result.content}
                  musicEntityType={result.musicEntityType}
                  musicEntityId={result.musicEntityId}
                  onClick={closeSearch}
                />
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='flex items-center justify-between border-b border-border/40 pb-4'>
      <div className='flex items-center gap-1'>
        {prev ? (
          <Link
            to='/tweet/$slug'
            params={{ slug: prev.slug }}
            aria-label='Previous tweet'
            className={iconButtonClassName}>
            <ChevronLeft className='h-4 w-4' />
          </Link>
        ) : (
          <span aria-hidden className={disabledIconButtonClassName}>
            <ChevronLeft className='h-4 w-4' />
          </span>
        )}

        {next ? (
          <Link
            to='/tweet/$slug'
            params={{ slug: next.slug }}
            aria-label='Next tweet'
            className={iconButtonClassName}>
            <ChevronRight className='h-4 w-4' />
          </Link>
        ) : (
          <span aria-hidden className={disabledIconButtonClassName}>
            <ChevronRight className='h-4 w-4' />
          </span>
        )}
      </div>

      <div className='flex items-center gap-1'>
        <button
          type='button'
          onClick={() => setIsSearchOpen(true)}
          aria-label='Search tweets'
          className={iconButtonClassName}>
          <Search className='h-4 w-4' />
        </button>

        <button
          type='button'
          onClick={() => goToRandom(slug)}
          aria-label='Random tweet'
          className={iconButtonClassName}>
          <Shuffle className='h-4 w-4' />
        </button>
      </div>
    </div>
  )
}
