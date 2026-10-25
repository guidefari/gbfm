import { Effect, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { parseMultipartParts } from './r2-multipart'

describe('R2 multipart list response', () => {
  test.each(['&quot;', '&#34;', '&#x22;', '"'])(
    'decodes %s quote delimiters to match upload response ETags',
    async (quote) => {
      const etag = 'b7fd5b3378fda7acd3bd14ae630aa280'
      const response = `<ListPartsResult><Part><PartNumber>1</PartNumber><ETag>${quote}${etag}${quote}</ETag><Size>8388608</Size></Part></ListPartsResult>`

      expect(await Effect.runPromise(parseMultipartParts(response))).toEqual([
        { partNumber: 1, etag: `"${etag}"`, size: 8388608 },
      ])
    },
  )

  test('preserves unquoted ETags', async () => {
    expect(
      await Effect.runPromise(
        parseMultipartParts(
          '<ListPartsResult><Part><PartNumber>1</PartNumber><ETag>abc123</ETag><Size>42</Size></Part></ListPartsResult>',
        ),
      ),
    ).toEqual([{ partNumber: 1, etag: 'abc123', size: 42 }])
  })

  test.each([
    '<PartNumber>0</PartNumber><ETag>abc123</ETag><Size>42</Size>',
    '<PartNumber>1.5</PartNumber><ETag>abc123</ETag><Size>42</Size>',
    '<PartNumber>10001</PartNumber><ETag>abc123</ETag><Size>42</Size>',
    '<PartNumber>1</PartNumber><Size>42</Size>',
    '<PartNumber>1</PartNumber><ETag>abc123</ETag>',
    '<PartNumber>1</PartNumber><ETag>abc123</ETag><Size> </Size>',
    '<PartNumber>1</PartNumber><ETag>abc123</ETag><Size>-1</Size>',
    '<PartNumber>1</PartNumber><ETag>abc123</ETag><Size>1.5</Size>',
    '',
  ])('returns a typed failure for an invalid part: %s', async (part) => {
    const result = await Effect.runPromise(
      Effect.result(parseMultipartParts(`<ListPartsResult><Part>${part}</Part></ListPartsResult>`)),
    )

    expect(Result.isFailure(result) && result.failure._tag).toBe('InvalidMultipartPart')
    expect(Result.isFailure(result) && result.failure.partIndex).toBe(0)
  })

  test('accepts an upload with no completed parts', async () => {
    expect(
      await Effect.runPromise(parseMultipartParts('<ListPartsResult></ListPartsResult>')),
    ).toEqual([])
  })
})
