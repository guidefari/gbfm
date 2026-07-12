import { Exit, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  CompleteMultipartUploadInput,
  InitMultipartUploadInput,
  PartNumberFromString
} from './upload'

describe('upload API contract', () => {
  it('decodes partNumber from a string, matching multipart/form-data field decoding', () => {
    // multipart/form-data fields always arrive as strings -- the resumable
    // upload client (apps/www/src/services/resumable-upload/service.ts) sends
    // String(part.partNumber). A plain Schema.Number for
    // UploadMultipartPartInput.partNumber would reject every real request;
    // this pins the NumberFromString requirement directly (rather than
    // through the full multipart struct, which needs a real
    // Multipart.PersistedFile instance to satisfy `chunk` and can't be
    // faked with a plain object) so it can't silently regress.
    expect(Schema.decodeUnknownSync(PartNumberFromString)('1')).toBe(1)
  })

  it('rejects a partNumber outside 1-10000', () => {
    const tooLow = Schema.decodeUnknownExit(PartNumberFromString)('0')
    const tooHigh = Schema.decodeUnknownExit(PartNumberFromString)('10001')

    expect(Exit.isFailure(tooLow)).toBe(true)
    expect(Exit.isFailure(tooHigh)).toBe(true)
  })

  it('rejects a non-integer partNumber', () => {
    const result = Schema.decodeUnknownExit(PartNumberFromString)('1.5')

    expect(Exit.isFailure(result)).toBe(true)
  })

  it('rejects a non-audio content type on multipart init', () => {
    const result = Schema.decodeUnknownExit(InitMultipartUploadInput)({
      fileName: 'test.mp3',
      contentType: 'image/png',
      fileSize: 1024,
      fileType: 'audio'
    })

    expect(Exit.isFailure(result)).toBe(true)
  })

  it('rejects a non-integer or non-positive fileSize on multipart init', () => {
    const nonInteger = Schema.decodeUnknownExit(InitMultipartUploadInput)({
      fileName: 'test.mp3',
      contentType: 'audio/mpeg',
      fileSize: 1024.5,
      fileType: 'audio'
    })
    const nonPositive = Schema.decodeUnknownExit(InitMultipartUploadInput)({
      fileName: 'test.mp3',
      contentType: 'audio/mpeg',
      fileSize: 0,
      fileType: 'audio'
    })

    expect(Exit.isFailure(nonInteger)).toBe(true)
    expect(Exit.isFailure(nonPositive)).toBe(true)
  })

  it('accepts a real completion payload with numeric JSON part numbers', () => {
    const result = Schema.decodeUnknownSync(CompleteMultipartUploadInput)({
      key: 'user123/audio_1_test.mp3',
      uploadId: 'upload-id',
      parts: [
        { partNumber: 1, etag: 'etag-1' },
        { partNumber: 2, etag: 'etag-2' }
      ]
    })

    expect(result.parts).toHaveLength(2)
  })

  it('rejects an empty parts array on completion', () => {
    const result = Schema.decodeUnknownExit(CompleteMultipartUploadInput)({
      key: 'user123/audio_1_test.mp3',
      uploadId: 'upload-id',
      parts: []
    })

    expect(Exit.isFailure(result)).toBe(true)
  })
})
