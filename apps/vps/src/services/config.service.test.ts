import { Redacted, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { StorageConfigSchema } from './config.service'

const decodeStorageConfig = Schema.decodeUnknownSync(StorageConfigSchema)

describe('StorageConfigSchema', () => {
  test('accepts AWS with ambient credentials', () => {
    expect(decodeStorageConfig({ provider: 'aws', region: 'us-east-1' })).toMatchObject({
      provider: 'aws',
      region: 'us-east-1'
    })
  })

  test('rejects R2 without its endpoint and credentials', () => {
    expect(() => decodeStorageConfig({ provider: 'r2', region: 'auto' })).toThrow(
      /r2 provider requires endpoint and credentials/
    )
  })

  test('does not serialize R2 credentials', () => {
    const accessKey = 'r2-access-key-for-test'
    const secretKey = 'r2-secret-key-for-test'
    const config = decodeStorageConfig({
      provider: 'r2',
      endpoint: 'https://account.r2.cloudflarestorage.com',
      region: 'auto',
      accessKeyId: Redacted.make(accessKey),
      secretAccessKey: Redacted.make(secretKey)
    })

    expect(String(config)).not.toContain(accessKey)
    expect(String(config)).not.toContain(secretKey)
    expect(JSON.stringify(config)).not.toContain(accessKey)
    expect(JSON.stringify(config)).not.toContain(secretKey)
  })
})
