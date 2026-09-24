'use client'

import { ComposerPage } from './-ComposerPage'

type NewContentSearch = {
  readonly mode?: 'tweet' | 'editorial'
  readonly edit?: string
}

export function NewContentPage({ search }: { search: NewContentSearch }) {
  return (
    <div className='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8'>
      <ComposerPage editSlug={search.edit} />
    </div>
  )
}
