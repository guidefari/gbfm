'use client'

import { useNavigate, useSearch } from '@tanstack/react-router'
import { EditorialComposer } from './-EditorialComposer'
import { TweetComposer } from './-TweetComposer'

const modes = [
  { value: 'tweet', label: 'Tweet' },
  { value: 'editorial', label: 'Editorial' }
] as const

export function NewContentPage() {
  const search = useSearch({ from: '/new/' })
  const navigate = useNavigate()
  const mode = search.mode ?? 'tweet'

  function selectMode(next: 'tweet' | 'editorial') {
    if (next === mode) return
    void navigate({ to: '/new', search: { mode: next, edit: undefined } })
  }

  return (
    <div className='mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8'>
      {!search.edit ? (
        <div
          role='tablist'
          aria-label='Content type'
          className='mb-6 inline-flex border border-border/70 bg-gb-darker-bg p-0.5'>
          {modes.map((entry) => {
            const active = entry.value === mode
            return (
              <button
                key={entry.value}
                type='button'
                role='tab'
                aria-selected={active}
                onClick={() => selectMode(entry.value)}
                className={`px-5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-gb-pastel-green-2 text-gb-darker-bg'
                    : 'text-muted-foreground hover:text-foreground'
                }`}>
                {entry.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {mode === 'editorial' ? (
        <EditorialComposer editSlug={search.edit} />
      ) : (
        <TweetComposer editSlug={search.edit} />
      )}
    </div>
  )
}
