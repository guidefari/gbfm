#!/usr/bin/env bun

import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import {
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  paginateListObjectsV2,
  S3Client,
  type HeadObjectCommandOutput
} from '@aws-sdk/client-s3'

const BUCKETS = ['gbfm-prod-usercontentbucket-cohrefob', 'gbfm-prod-mixesbucket-zftkfrfx'] as const

const HEAD_CONCURRENCY = 16
const EXPECTED_MAX_OBJECT_BYTES = 500_000_000
const SUPER_SLURPER_MAX_OBJECT_BYTES = 1_000_000_000_000
const R2_MAX_KEY_BYTES = 1_024
const R2_MAX_METADATA_BYTES = 8_192
const SUPER_SLURPER_SKIPPED_STORAGE_CLASSES = new Set(['GLACIER', 'DEEP_ARCHIVE'])
const ARCHIVAL_ACCESS_TIERS = new Set(['ARCHIVE_ACCESS', 'DEEP_ARCHIVE_ACCESS'])

type ListedObject = {
  readonly key: string
  readonly size: number
  readonly storageClass: string
}

type RedactedObject = {
  readonly keySha256: string
  readonly extension: string | null
  readonly size: number
}

type MetadataSummary = {
  readonly contentTypes: Readonly<Record<string, number>>
  readonly customMetadataKeys: Readonly<Record<string, number>>
  readonly httpFieldsPresent: Readonly<Record<string, number>>
  readonly serverSideEncryption: Readonly<Record<string, number>>
  readonly objectsWithCustomMetadata: number
  readonly maximumEstimatedMetadataBytes: number
}

class InventoryFailure extends Error {
  constructor(bucket: string, operation: string, key?: string) {
    const object = key === undefined ? '' : ` for object ${hashKey(key)}`
    super(`Could not ${operation}${object} in bucket ${bucket}`)
  }
}

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')

const redactObject = (object: ListedObject): RedactedObject => {
  const extension = extname(object.key)
  return {
    keySha256: hashKey(object.key),
    extension: extension.length === 0 ? null : extension,
    size: object.size
  }
}

const increment = (counts: Map<string, number>, key: string) => {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

const sortedRecord = (counts: Map<string, number>): Readonly<Record<string, number>> =>
  Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)))

const utf8Bytes = (value: string) => Buffer.byteLength(value, 'utf8')

const metadataBytes = (metadata: Readonly<Record<string, string>>): number =>
  Object.entries(metadata).reduce(
    (total, [key, value]) => total + utf8Bytes(`x-amz-meta-${key}`) + utf8Bytes(value),
    0
  )

const presentHttpMetadata = (head: HeadObjectCommandOutput) =>
  [
    ['cache-control', head.CacheControl],
    ['content-disposition', head.ContentDisposition],
    ['content-encoding', head.ContentEncoding],
    ['content-language', head.ContentLanguage],
    ['content-type', head.ContentType],
    ['expires', head.Expires?.toISOString()]
  ].flatMap(([name, value]) =>
    typeof name === 'string' && typeof value === 'string' ? [{ name, value }] : []
  )

const inConcurrentChunks = async <Input, Output>(
  values: ReadonlyArray<Input>,
  concurrency: number,
  transform: (value: Input) => Promise<Output>
): Promise<ReadonlyArray<Output>> => {
  const results: Output[] = []
  for (let offset = 0; offset < values.length; offset += concurrency) {
    const chunk = values.slice(offset, offset + concurrency)
    results.push(...(await Promise.all(chunk.map(transform))))
  }
  return results
}

const listObjects = async (
  client: S3Client,
  bucket: string
): Promise<ReadonlyArray<ListedObject>> => {
  const objects: ListedObject[] = []
  try {
    for await (const page of paginateListObjectsV2({ client }, { Bucket: bucket })) {
      for (const object of page.Contents ?? []) {
        if (object.Key === undefined) continue
        objects.push({
          key: object.Key,
          size: object.Size ?? 0,
          storageClass: object.StorageClass ?? 'STANDARD'
        })
      }
    }
  } catch {
    throw new InventoryFailure(bucket, 'list objects')
  }
  return objects
}

const inventoryMetadata = async (
  client: S3Client,
  bucket: string,
  objects: ReadonlyArray<ListedObject>
): Promise<{
  readonly metadata: MetadataSummary
  readonly archivalAccessTierObjects: ReadonlyArray<RedactedObject>
  readonly oversizedMetadataObjects: ReadonlyArray<RedactedObject>
}> => {
  const contentTypes = new Map<string, number>()
  const customMetadataKeys = new Map<string, number>()
  const httpFieldsPresent = new Map<string, number>()
  const serverSideEncryption = new Map<string, number>()
  let objectsWithCustomMetadata = 0
  let maximumEstimatedMetadataBytes = 0

  const inspected = await inConcurrentChunks(objects, HEAD_CONCURRENCY, async (object) => {
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: object.key }))
      const customMetadata = head.Metadata ?? {}
      const httpMetadata = presentHttpMetadata(head)
      const estimatedMetadataBytes =
        metadataBytes(customMetadata) +
        httpMetadata.reduce(
          (total, field) => total + utf8Bytes(field.name) + utf8Bytes(field.value),
          0
        )

      if (head.ContentType !== undefined) increment(contentTypes, head.ContentType)
      if (head.ServerSideEncryption !== undefined) {
        increment(serverSideEncryption, head.ServerSideEncryption)
      }
      if (Object.keys(customMetadata).length > 0) objectsWithCustomMetadata += 1
      for (const key of Object.keys(customMetadata)) increment(customMetadataKeys, key)
      for (const field of httpMetadata) increment(httpFieldsPresent, field.name)
      maximumEstimatedMetadataBytes = Math.max(
        maximumEstimatedMetadataBytes,
        estimatedMetadataBytes
      )

      return {
        object,
        archiveStatus: head.ArchiveStatus,
        estimatedMetadataBytes
      }
    } catch {
      throw new InventoryFailure(bucket, 'inspect metadata', object.key)
    }
  })

  return {
    metadata: {
      contentTypes: sortedRecord(contentTypes),
      customMetadataKeys: sortedRecord(customMetadataKeys),
      httpFieldsPresent: sortedRecord(httpFieldsPresent),
      serverSideEncryption: sortedRecord(serverSideEncryption),
      objectsWithCustomMetadata,
      maximumEstimatedMetadataBytes
    },
    archivalAccessTierObjects: inspected
      .filter(
        ({ archiveStatus }) =>
          archiveStatus !== undefined && ARCHIVAL_ACCESS_TIERS.has(archiveStatus)
      )
      .map(({ object }) => redactObject(object)),
    oversizedMetadataObjects: inspected
      .filter(({ estimatedMetadataBytes }) => estimatedMetadataBytes > R2_MAX_METADATA_BYTES)
      .map(({ object }) => redactObject(object))
  }
}

const listIncompleteMultipartUploads = async (client: S3Client, bucket: string) => {
  const uploads: Array<{
    readonly keySha256: string
    readonly extension: string | null
    readonly initiated: string | null
  }> = []
  try {
    let keyMarker: string | undefined
    let uploadIdMarker: string | undefined
    let isTruncated = false
    do {
      const page = await client.send(
        new ListMultipartUploadsCommand({
          Bucket: bucket,
          KeyMarker: keyMarker,
          UploadIdMarker: uploadIdMarker
        })
      )
      for (const upload of page.Uploads ?? []) {
        if (upload.Key === undefined) continue
        const extension = extname(upload.Key)
        uploads.push({
          keySha256: hashKey(upload.Key),
          extension: extension.length === 0 ? null : extension,
          initiated: upload.Initiated?.toISOString() ?? null
        })
      }
      isTruncated = page.IsTruncated === true
      keyMarker = isTruncated ? page.NextKeyMarker : undefined
      uploadIdMarker = isTruncated ? page.NextUploadIdMarker : undefined
      if (isTruncated && keyMarker === undefined) {
        throw new InventoryFailure(bucket, 'paginate incomplete multipart uploads')
      }
    } while (isTruncated)
  } catch {
    throw new InventoryFailure(bucket, 'list incomplete multipart uploads')
  }
  return uploads
}

const inventoryBucket = async (client: S3Client, bucket: string) => {
  const objects = await listObjects(client, bucket)
  const [metadataResult, incompleteMultipartUploads] = await Promise.all([
    inventoryMetadata(client, bucket, objects),
    listIncompleteMultipartUploads(client, bucket)
  ])
  const storageClasses = new Map<string, number>()
  for (const object of objects) increment(storageClasses, object.storageClass)

  let largestObject: ListedObject | undefined
  for (const object of objects) {
    if (largestObject === undefined || object.size > largestObject.size) largestObject = object
  }
  const skippedStorageClassObjects = objects
    .filter((object) => SUPER_SLURPER_SKIPPED_STORAGE_CLASSES.has(object.storageClass))
    .map(redactObject)
  const archivalObjects = [
    ...skippedStorageClassObjects,
    ...metadataResult.archivalAccessTierObjects
  ]

  return {
    bucket,
    objectCount: objects.length,
    totalBytes: objects.reduce((total, object) => total + object.size, 0),
    storageClasses: sortedRecord(storageClasses),
    largestObject: largestObject === undefined ? null : redactObject(largestObject),
    metadata: metadataResult.metadata,
    incompleteMultipartUploads,
    exceptions: {
      aboveExpected500Mb: objects
        .filter((object) => object.size > EXPECTED_MAX_OBJECT_BYTES)
        .map(redactObject),
      aboveSuperSlurper1Tb: objects
        .filter((object) => object.size > SUPER_SLURPER_MAX_OBJECT_BYTES)
        .map(redactObject),
      archivalObjects,
      keysAboveR2Limit: objects
        .filter((object) => utf8Bytes(object.key) > R2_MAX_KEY_BYTES)
        .map(redactObject),
      metadataAboveR2Limit: metadataResult.oversizedMetadataObjects
    }
  }
}

const client = new S3Client({})
try {
  const buckets = []
  for (const bucket of BUCKETS) buckets.push(await inventoryBucket(client, bucket))

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        redaction: 'Object keys are represented by SHA-256 hashes and file extensions only.',
        limits: {
          expectedMaximumObjectBytes: EXPECTED_MAX_OBJECT_BYTES,
          superSlurperMaximumObjectBytes: SUPER_SLURPER_MAX_OBJECT_BYTES,
          r2MaximumKeyBytes: R2_MAX_KEY_BYTES,
          r2MaximumMetadataBytes: R2_MAX_METADATA_BYTES
        },
        buckets
      },
      null,
      2
    )
  )
} catch (error: unknown) {
  console.error(error instanceof InventoryFailure ? error.message : 'Bucket inventory failed')
  process.exitCode = 1
} finally {
  client.destroy()
}
