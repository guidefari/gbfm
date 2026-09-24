import { describe, expect, it } from 'vitest'
import { Schema } from 'effect'
import { createFileRoute } from './page'
import { preparePage } from './prepare-page'

const anonymous = { user: null, isAuthenticated: false } as const

describe('preparePage', () => {
  it('decodes URL search values through a callable Standard Schema adapter', async () => {
    const route = createFileRoute('/search')({
      validateSearch: Schema.toStandardSchemaV1(Schema.Struct({ page: Schema.NumberFromString }))
    })

    const prepared = await preparePage(
      route,
      new URL('https://example.com/search?page=3'),
      {},
      anonymous
    )

    expect(prepared.search).toEqual({ page: 3 })
  })

  it('continues to support plain search validator functions', async () => {
    const route = createFileRoute('/search')({
      validateSearch: (search) => ({ query: search.query ?? 'all' })
    })

    const prepared = await preparePage(
      route,
      new URL('https://example.com/search?query=house'),
      {},
      anonymous
    )

    expect(prepared.search).toEqual({ query: 'house' })
  })
})
