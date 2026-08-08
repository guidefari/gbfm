#!/usr/bin/env bun

import { createHash } from 'node:crypto'
import {
  GetObjectCommand,
  HeadObjectCommand,
  paginateListObjectsV2,
  S3Client,
  type HeadObjectCommandOutput
} from '@aws-sdk/client-s3'

const DEFAULT_SOURCE_BUCKET = 'gbfm-prod-mixesbucket-zftkfrfx'
const DEFAULT_DESTINATION_BUCKET = 'gbfm-mixes'
const DEFAULT_HEAD_CONCURRENCY = 8
const DEFAULT_HASH_SAMPLE_SIZE = 5

export type ObjectMetadata = {
  readonly cacheControl: string | null
  readonly contentDisposition: string | null
  readonly contentEncoding: string | null
  readonly contentLanguage: string | null
  readonly contentType: string | null
  readonly expires: string | null
  readonly custom: Readonly<Record<string, string>>
}

export type ObjectInventory = {
  readonly key: string
  readonly size: number
  readonly metadata: ObjectMetadata
}

type InventoryMismatch =
  | {
      readonly kind: 'MissingFromDestination' | 'UnexpectedInDestination'
      readonly keySha256: string
    }
  | {
      readonly kind: 'Size'
      readonly keySha256: string
      readonly source: number
      readonly destination: number
    }
  | {
      readonly kind: 'Metadata'
      readonly keySha256: string
      readonly fields: ReadonlyArray<string>
    }

type InventorySummary = {
  readonly objectCount: number
  readonly totalBytes: number
}

export type InventoryComparison = {
  readonly source: InventorySummary
  readonly destination: InventorySummary
  readonly mismatches: ReadonlyArray<InventoryMismatch>
}

class ParityFailure extends Error {
  constructor(side: 'source' | 'destination', operation: string, key?: string) {
    const object = key === undefined ? '' : ` for object ${hashKey(key)}`
    super(`Could not ${operation}${object} on the ${side} bucket`)
  }
}

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')

const inventorySummary = (objects: ReadonlyArray<ObjectInventory>): InventorySummary => ({
  objectCount: objects.length,
  totalBytes: objects.reduce((total, object) => total + object.size, 0)
})

const sortedRecord = (record: Readonly<Record<string, string>>) =>
  Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)))

const differingMetadataFields = (
  source: ObjectMetadata,
  destination: ObjectMetadata
): ReadonlyArray<string> => {
  const fields: string[] = []
  if (source.cacheControl !== destination.cacheControl) fields.push('cacheControl')
  if (source.contentDisposition !== destination.contentDisposition)
    fields.push('contentDisposition')
  if (source.contentEncoding !== destination.contentEncoding) fields.push('contentEncoding')
  if (source.contentLanguage !== destination.contentLanguage) fields.push('contentLanguage')
  if (source.contentType !== destination.contentType) fields.push('contentType')
  if (source.expires !== destination.expires) fields.push('expires')
  if (
    JSON.stringify(sortedRecord(source.custom)) !== JSON.stringify(sortedRecord(destination.custom))
  ) {
    fields.push('custom')
  }
  return fields
}

export type ContentHashSample = {
  readonly key: string
  readonly sourceSha256: string
  readonly destinationSha256: string
}

export const compareContentHashSample = (sample: ReadonlyArray<ContentHashSample>) =>
  sample
    .filter(({ sourceSha256, destinationSha256 }) => sourceSha256 !== destinationSha256)
    .map(({ key }) => ({ keySha256: hashKey(key) }))

export const compareInventories = (
  source: ReadonlyArray<ObjectInventory>,
  destination: ReadonlyArray<ObjectInventory>
): InventoryComparison => {
  const destinationByKey = new Map(destination.map((object) => [object.key, object]))
  const sourceKeys = new Set(source.map((object) => object.key))
  const mismatches: InventoryMismatch[] = []

  for (const sourceObject of source) {
    const destinationObject = destinationByKey.get(sourceObject.key)
    const keySha256 = hashKey(sourceObject.key)
    if (destinationObject === undefined) {
      mismatches.push({ kind: 'MissingFromDestination', keySha256 })
      continue
    }
    if (sourceObject.size !== destinationObject.size) {
      mismatches.push({
        kind: 'Size',
        keySha256,
        source: sourceObject.size,
        destination: destinationObject.size
      })
    }
    const fields = differingMetadataFields(sourceObject.metadata, destinationObject.metadata)
    if (fields.length > 0) mismatches.push({ kind: 'Metadata', keySha256, fields })
  }

  for (const destinationObject of destination) {
    if (!sourceKeys.has(destinationObject.key)) {
      mismatches.push({
        kind: 'UnexpectedInDestination',
        keySha256: hashKey(destinationObject.key)
      })
    }
  }

  return {
    source: inventorySummary(source),
    destination: inventorySummary(destination),
    mismatches
  }
}

type ListedObject = {
  readonly key: string
  readonly size: number
}

const listObjects = async (
  client: S3Client,
  bucket: string,
  side: 'source' | 'destination'
): Promise<ReadonlyArray<ListedObject>> => {
  const objects: ListedObject[] = []
  try {
    for await (const page of paginateListObjectsV2({ client }, { Bucket: bucket })) {
      for (const object of page.Contents ?? []) {
        if (object.Key !== undefined) objects.push({ key: object.Key, size: object.Size ?? 0 })
      }
    }
  } catch {
    throw new ParityFailure(side, 'list objects')
  }
  return objects.sort((left, right) => left.key.localeCompare(right.key))
}

const normalizedMetadata = (head: HeadObjectCommandOutput): ObjectMetadata => ({
  cacheControl: head.CacheControl ?? null,
  contentDisposition: head.ContentDisposition ?? null,
  contentEncoding: head.ContentEncoding ?? null,
  contentLanguage: head.ContentLanguage ?? null,
  contentType: head.ContentType ?? null,
  expires: head.Expires?.toISOString() ?? null,
  custom: sortedRecord(head.Metadata ?? {})
})

const inspectObjects = async (
  client: S3Client,
  bucket: string,
  side: 'source' | 'destination',
  listed: ReadonlyArray<ListedObject>,
  concurrency: number
): Promise<ReadonlyArray<ObjectInventory>> => {
  const inventory: ObjectInventory[] = []
  for (let offset = 0; offset < listed.length; offset += concurrency) {
    const chunk = listed.slice(offset, offset + concurrency)
    inventory.push(
      ...(await Promise.all(
        chunk.map(async (object) => {
          try {
            const head = await client.send(
              new HeadObjectCommand({ Bucket: bucket, Key: object.key })
            )
            return {
              key: object.key,
              size: head.ContentLength ?? object.size,
              metadata: normalizedMetadata(head)
            }
          } catch {
            throw new ParityFailure(side, 'inspect metadata', object.key)
          }
        })
      ))
    )
  }
  return inventory
}

const contentSha256 = async (
  client: S3Client,
  bucket: string,
  side: 'source' | 'destination',
  key: string
): Promise<string> => {
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (response.Body === undefined) throw new ParityFailure(side, 'read content', key)
    const stream = response.Body.transformToWebStream()
    const reader = stream.getReader()
    const hash = createHash('sha256')
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      hash.update(chunk.value)
    }
    return hash.digest('hex')
  } catch (error: unknown) {
    if (error instanceof ParityFailure) throw error
    throw new ParityFailure(side, 'hash content', key)
  }
}

const selectSample = (
  objects: ReadonlyArray<ObjectInventory>,
  requestedSize: number
): ReadonlyArray<ObjectInventory> => {
  if (requestedSize <= 0 || objects.length === 0) return []
  if (requestedSize >= objects.length) return objects
  if (requestedSize === 1) return [objects[0]]

  const selected: ObjectInventory[] = []
  for (let index = 0; index < requestedSize; index += 1) {
    const objectIndex = Math.round((index * (objects.length - 1)) / (requestedSize - 1))
    const object = objects[objectIndex]
    if (object !== undefined) selected.push(object)
  }
  return selected
}

const positiveInteger = (name: string, fallback: number): number => {
  const value = process.env[name]
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive integer`)
  return parsed
}

const requiredEnvironment = (name: string): string => {
  const value = process.env[name]
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`)
  return value
}

const r2Endpoint = (): string => {
  const configured = process.env.R2_ENDPOINT
  if (configured !== undefined && configured.length > 0) return configured
  const accountId = process.env.CLOUDFLARE_DEFAULT_ACCOUNT_ID
  if (accountId !== undefined && accountId.length > 0) {
    return `https://${accountId}.r2.cloudflarestorage.com`
  }
  throw new Error('R2_ENDPOINT or CLOUDFLARE_DEFAULT_ACCOUNT_ID is required')
}

const run = async () => {
  const sourceBucket = process.env.SOURCE_BUCKET ?? DEFAULT_SOURCE_BUCKET
  const destinationBucket = process.env.DESTINATION_BUCKET ?? DEFAULT_DESTINATION_BUCKET
  const hashSampleSize = positiveInteger('HASH_SAMPLE_SIZE', DEFAULT_HASH_SAMPLE_SIZE)
  const headConcurrency = positiveInteger('HEAD_CONCURRENCY', DEFAULT_HEAD_CONCURRENCY)
  const endpoint = r2Endpoint()
  const accessKeyId = requiredEnvironment('R2_ACCESS_KEY_ID')
  const secretAccessKey = requiredEnvironment('R2_SECRET_ACCESS_KEY')
  const sourceClient = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
  const destinationClient = new S3Client({
    endpoint,
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey }
  })

  try {
    const [sourceListed, destinationListed] = await Promise.all([
      listObjects(sourceClient, sourceBucket, 'source'),
      listObjects(destinationClient, destinationBucket, 'destination')
    ])
    const [source, destination] = await Promise.all([
      inspectObjects(sourceClient, sourceBucket, 'source', sourceListed, headConcurrency),
      inspectObjects(
        destinationClient,
        destinationBucket,
        'destination',
        destinationListed,
        headConcurrency
      )
    ])
    const comparison = compareInventories(source, destination)
    const destinationKeys = new Set(destination.map((object) => object.key))
    const sample = selectSample(
      source.filter((object) => destinationKeys.has(object.key)),
      hashSampleSize
    )
    const contentHashes: ContentHashSample[] = []

    for (const object of sample) {
      const [sourceSha256, destinationSha256] = await Promise.all([
        contentSha256(sourceClient, sourceBucket, 'source', object.key),
        contentSha256(destinationClient, destinationBucket, 'destination', object.key)
      ])
      contentHashes.push({ key: object.key, sourceSha256, destinationSha256 })
    }
    const hashMismatches = compareContentHashSample(contentHashes)

    const result = {
      generatedAt: new Date().toISOString(),
      sourceBucket,
      destinationBucket,
      comparison,
      contentHashSample: {
        requested: hashSampleSize,
        compared: sample.length,
        mismatches: hashMismatches
      }
    }
    console.log(JSON.stringify(result, null, 2))
    if (comparison.mismatches.length > 0 || hashMismatches.length > 0) process.exitCode = 1
  } finally {
    sourceClient.destroy()
    destinationClient.destroy()
  }
}

if (import.meta.main) {
  try {
    await run()
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : 'R2 parity verification failed')
    process.exitCode = 1
  }
}
