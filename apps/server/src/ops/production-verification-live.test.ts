import {
  safeAwsErrorCode,
  sentrySpanResponseIsTruncated
} from '../../scripts/production-verification-live'
import { describe, expect, test } from 'vitest'

describe('production verification live boundaries', () => {
  test('extracts only a bounded AWS error code', () => {
    expect(
      safeAwsErrorCode(
        'An error occurred (AccessDeniedException) when calling GetResources: account details'
      )
    ).toBe('AccessDeniedException')
    expect(safeAwsErrorCode('arbitrary stderr with arn:aws:iam::123456789012:role/private')).toBe(
      undefined
    )
  })

  test('fails closed when Sentry reports another page', () => {
    const response = new Response(null, {
      headers: {
        link: '<https://sentry.io/next>; rel="next"; results="true"; cursor="opaque"'
      }
    })

    expect(sentrySpanResponseIsTruncated(response, { data: [{ id: 'span-1' }] })).toBe(true)
  })

  test('fails closed when a full Sentry page has ambiguous pagination metadata', () => {
    const response = new Response()
    const data = Array.from({ length: 100 }, (_, index) => ({ id: `span-${index}` }))

    expect(sentrySpanResponseIsTruncated(response, { data })).toBe(true)
    expect(sentrySpanResponseIsTruncated(response, { data: data.slice(0, 99) })).toBe(false)
  })
})
