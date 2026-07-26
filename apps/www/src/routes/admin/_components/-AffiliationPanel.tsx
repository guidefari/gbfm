import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@gbfm/ui'
import { Plus, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

export interface AffiliationOption {
  readonly id: string
  readonly name: string
  readonly publishedAt: string | null
  readonly detail?: string
}

interface Props {
  readonly title: string
  readonly description: string
  readonly items: readonly AffiliationOption[]
  readonly candidates: readonly AffiliationOption[]
  readonly isLoading: boolean
  readonly error: Error | null
  readonly isMutating: boolean
  readonly onAdd: (id: string) => Promise<void>
  readonly onRemove: (id: string) => Promise<void>
}

export function AffiliationPanel({
  title,
  description,
  items,
  candidates,
  isLoading,
  error,
  isMutating,
  onAdd,
  onRemove
}: Props) {
  const searchId = useId()
  const [search, setSearch] = useState('')
  const [mutationError, setMutationError] = useState<string | null>(null)
  const itemIds = useMemo(() => new Set(items.map(({ id }) => id)), [items])
  const available = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return candidates
      .filter(({ id }) => !itemIds.has(id))
      .filter(
        ({ name, detail }) =>
          query.length === 0 ||
          name.toLocaleLowerCase().includes(query) ||
          detail?.toLocaleLowerCase().includes(query)
      )
      .slice(0, 8)
  }, [candidates, itemIds, search])

  const runMutation = async (mutation: () => Promise<void>, clearSearch = false) => {
    setMutationError(null)
    try {
      await mutation()
      if (clearSearch) setSearch('')
    } catch (cause: unknown) {
      setMutationError(
        cause instanceof Error ? cause.message : 'The affiliation could not be saved.'
      )
    }
  }

  return (
    <Card>
      <CardHeader className='space-y-1'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <p className='text-sm text-muted-foreground'>{description}</p>
      </CardHeader>
      <CardContent className='space-y-5'>
        {error && (
          <p role='alert' className='text-sm text-destructive'>
            Could not load affiliations: {error.message}
          </p>
        )}
        {mutationError && (
          <p role='alert' className='text-sm text-destructive'>
            {mutationError}
          </p>
        )}
        {isLoading ? (
          <p className='text-sm text-muted-foreground'>Loading affiliations…</p>
        ) : items.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No affiliations yet.</p>
        ) : (
          <ul className='space-y-2' aria-label={`Current ${title.toLocaleLowerCase()}`}>
            {items.map((item) => (
              <li key={item.id} className='flex items-center gap-3 rounded-md border px-3 py-2'>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium'>{item.name}</p>
                  {item.detail && (
                    <p className='truncate text-xs text-muted-foreground'>{item.detail}</p>
                  )}
                </div>
                <Badge variant={item.publishedAt ? 'default' : 'secondary'}>
                  {item.publishedAt ? 'Published' : 'Draft'}
                </Badge>
                <Button
                  type='button'
                  size='icon'
                  variant='ghost'
                  aria-label={`Remove ${item.name}`}
                  disabled={isMutating}
                  onClick={() => void runMutation(() => onRemove(item.id))}>
                  <X className='h-4 w-4' />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className='space-y-2'>
          <label htmlFor={searchId} className='text-sm font-medium'>
            Add {title.toLocaleLowerCase()}
          </label>
          <Input
            id={searchId}
            type='search'
            placeholder={`Search ${title.toLocaleLowerCase()}…`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ul className='max-h-64 space-y-1 overflow-y-auto' aria-label={`Available ${title}`}>
            {available.map((option) => (
              <li key={option.id}>
                <Button
                  type='button'
                  variant='ghost'
                  className='h-auto w-full justify-start gap-3 px-3 py-2 text-left'
                  disabled={isMutating}
                  onClick={() => void runMutation(() => onAdd(option.id), true)}>
                  <Plus className='h-4 w-4 shrink-0' />
                  <span className='min-w-0'>
                    <span className='block truncate text-sm font-medium'>{option.name}</span>
                    {option.detail && (
                      <span className='block truncate text-xs text-muted-foreground'>
                        {option.detail}
                      </span>
                    )}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          {!isLoading && available.length === 0 && (
            <p className='text-xs text-muted-foreground'>No matching entities available.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
