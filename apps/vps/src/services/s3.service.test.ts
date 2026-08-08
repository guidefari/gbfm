import { readFile, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { Effect, Layer, Redacted } from 'effect'
import { describe, expect, test } from 'vitest'
import { config, ConfigService } from './config.service'
import { S3Service, S3ServiceLayer } from './s3.service'
import { ObjectStoreClientLayer } from './storage/object-store-client'

const sourceRoot = new URL('../', import.meta.url)

describe('S3Service client ownership', () => {
  test('sends object operations through ObjectStoreClient', async () => {
    const requestReceived = Promise.withResolvers<{
      readonly body: string
      readonly method: string | undefined
      readonly pathname: string | undefined
    }>()
    const server = createServer((request, response) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.on('end', () => {
        requestReceived.resolve({
          body: Buffer.concat(chunks).toString('utf8'),
          method: request.method,
          pathname:
            request.url === undefined ? undefined : new URL(request.url, 'http://stub').pathname
        })
        response.writeHead(200, { ETag: '"test-etag"' })
        response.end()
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

    try {
      const address = server.address()
      if (address === null || typeof address === 'string')
        throw new Error('Test server has no port')
      const storage: ConfigService['storage'] = {
        provider: 'r2',
        endpoint: `http://127.0.0.1:${address.port}`,
        region: 'auto',
        accessKeyId: Redacted.make('access-key'),
        secretAccessKey: Redacted.make('secret-key')
      }
      const configLayer = Layer.succeed(ConfigService, { ...config, storage })
      const objectStoreLayer = ObjectStoreClientLayer.pipe(Layer.provide(configLayer))
      const s3Layer = S3ServiceLayer.pipe(Layer.provide(objectStoreLayer))

      await Effect.runPromise(
        Effect.gen(function* () {
          const s3 = yield* S3Service
          yield* s3.uploadFile('path/file.txt', 'hello object store', 'text/plain', 'test-bucket')
        }).pipe(Effect.provide(s3Layer))
      )

      await expect(requestReceived.promise).resolves.toMatchObject({
        body: 'hello object store',
        method: 'PUT',
        pathname: '/test-bucket/path/file.txt'
      })
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error)))
      )
    }
  })

  test('constructs S3Client only in ObjectStoreClient', async () => {
    const paths = await readdir(sourceRoot, { recursive: true })
    const sourceFiles = paths.filter((path) => path.endsWith('.ts'))
    const sources = await Promise.all(
      sourceFiles.map((path) => readFile(new URL(path, sourceRoot), 'utf8'))
    )
    const constructionCount = sources.reduce(
      (count, source) => count + (source.match(/new S3Client\(/g)?.length ?? 0),
      0
    )

    expect(constructionCount).toBe(1)
  })
})
