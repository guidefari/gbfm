import { Badge, Input } from '@gbfm/ui'
import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'
import { useId, useState } from 'react'
import { getApiClient } from '@/lib/api-client'

interface SearchResultItem {
  id: string
  title: string | null
  slug: string
  type: string
  thumbnailUrl: string | null
  description: string | null
}

interface SearchResults {
  shows: ReadonlyArray<SearchResultItem>
  audio: ReadonlyArray<SearchResultItem>
  posts: ReadonlyArray<SearchResultItem>
}

const GROUPS: Array<{ key: keyof SearchResults; label: string }> = [
  { key: 'shows', label: 'Shows' },
  { key: 'audio', label: 'Audio' },
  { key: 'posts', label: 'Posts' }
]

function ResultGroup({ label, items }: { label: string; items: ReadonlyArray<SearchResultItem> }) {
  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-2'>
        <h3 className='text-sm font-semibold tracking-[0.18em] text-muted-foreground'>{label}</h3>
        <Badge variant='secondary'>{items.length}</Badge>
      </div>

      {items.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No matches.</p>
      ) : (
        <ul className='divide-y rounded-sm border'>
          {items.map((item) => (
            <li key={item.id} className='flex flex-col gap-0.5 px-3 py-2'>
              <div className='flex items-center gap-2'>
                <span className='font-medium'>{item.title ?? '(untitled)'}</span>
                <Badge variant='outline'>{item.type}</Badge>
              </div>
              <span className='text-xs text-muted-foreground'>/{item.slug}</span>
              {item.description && (
                <span className='line-clamp-2 text-sm text-muted-foreground'>
                  {item.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SearchTab() {
  const inputId = useId()
  const [query, setQuery] = useState('')

  const { data, isPending, isError } = useQuery({
    queryKey: ['admin', 'search', query],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(client.search.searchContent({ query: { q: query, limit: 50 } }))
    },
    enabled: query.length >= 2
  })

  return (
    <div className='space-y-4'>
      <label htmlFor={inputId} className='text-sm font-medium'>
        Query
      </label>
      <Input
        id={inputId}
        placeholder='Search shows, audio, and posts...'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {query.length < 2 ? (
        <p className='text-sm text-muted-foreground'>Type at least 2 characters to search.</p>
      ) : isPending ? (
        <p className='text-sm text-muted-foreground'>Searching...</p>
      ) : isError ? (
        <p className='text-sm text-destructive'>Search failed.</p>
      ) : data ? (
        <div className='space-y-6'>
          {GROUPS.map(({ key, label }) => (
            <ResultGroup key={key} label={label} items={data[key]} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
