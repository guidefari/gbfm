import { Schema } from 'effect'
import { expect, test } from 'vitest'
import { paginationQuerySchema } from './pagination'

const decodePaginationQuery = Schema.decodeUnknownSync(paginationQuerySchema)

test('pagination query preserves coercion and defaults', () => {
  expect(decodePaginationQuery({})).toEqual({ limit: 20, offset: 0 })
  expect(decodePaginationQuery({ limit: '25', offset: '10' })).toEqual({ limit: 25, offset: 10 })
  expect(decodePaginationQuery({ limit: true, offset: null })).toEqual({ limit: 1, offset: 0 })
  expect(decodePaginationQuery({ limit: [50], offset: [5] })).toEqual({ limit: 50, offset: 5 })
})

test('pagination query rejects values outside its bounds', () => {
  expect(() => decodePaginationQuery({ limit: 0 })).toThrow()
  expect(() => decodePaginationQuery({ limit: 101 })).toThrow()
  expect(() => decodePaginationQuery({ offset: -1 })).toThrow()
  expect(() => decodePaginationQuery({ limit: 'not-a-number' })).toThrow()
})
