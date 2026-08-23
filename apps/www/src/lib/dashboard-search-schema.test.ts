import { Schema } from 'effect'
import { expect, test } from 'vitest'
import { dashboardMixesSearchSchema, dashboardOffsetSearchSchema } from './dashboard-search-schema'

const offsetValidator = Schema.toStandardSchemaV1(dashboardOffsetSearchSchema)['~standard'].validate
const mixesValidator = Schema.toStandardSchemaV1(dashboardMixesSearchSchema)['~standard'].validate

test('dashboard offset search preserves Zod coercion and fallback behavior', () => {
  expect(offsetValidator({})).toEqual({ value: { offset: 0 } })
  expect(offsetValidator({ offset: '12' })).toEqual({ value: { offset: 12 } })
  expect(offsetValidator({ offset: -1 })).toEqual({ value: { offset: 0 } })
  expect(offsetValidator({ offset: 1.5 })).toEqual({ value: { offset: 0 } })
  expect(offsetValidator({ offset: 'invalid' })).toEqual({ value: { offset: 0 } })
})

test('dashboard mix search recovers each malformed field independently', () => {
  expect(mixesValidator({ offset: '7', sort: 'invalid', order: 'asc' })).toEqual({
    value: { offset: 7, sort: 'created', order: 'asc' }
  })
  expect(mixesValidator({ offset: 'invalid', sort: 'plays', order: 'invalid' })).toEqual({
    value: { offset: 0, sort: 'plays', order: 'desc' }
  })
})
