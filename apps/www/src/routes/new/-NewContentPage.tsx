'use client'

import { useSearch } from '@tanstack/react-router'
import { ComposerPage } from './-ComposerPage'

export function NewContentPage() {
  const search = useSearch({ from: '/new/' })
  return (
    <div className='mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8'>
      <ComposerPage editSlug={search.edit} />
    </div>
  )
}
