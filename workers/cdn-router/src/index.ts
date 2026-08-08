import { matchRoute } from './route'

const notFound = () => new Response(null, { status: 404 })

const methodNotAllowed = () =>
  new Response(null, {
    status: 405,
    headers: { Allow: 'GET, HEAD' }
  })

const writeObjectHeaders = (object: R2Object, headers: Headers) => {
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  for (const [name, value] of Object.entries(object.customMetadata ?? {})) {
    headers.set(`x-amz-meta-${name}`, value)
  }
}

const resolveRange = (range: R2Range, objectSize: number) => {
  if ('suffix' in range && typeof range.suffix === 'number') {
    const length = Math.min(range.suffix, objectSize)
    return { offset: objectSize - length, length }
  }

  const offset = 'offset' in range && typeof range.offset === 'number' ? range.offset : 0
  const length =
    'length' in range && typeof range.length === 'number' ? range.length : objectSize - offset
  return { offset, length }
}

const failedPreconditionStatus = (headers: Headers) =>
  headers.has('if-none-match') || headers.has('if-modified-since') ? 304 : 412

const fetchObject = async (request: Request, bucket: R2Bucket, key: string) => {
  const object = await bucket.get(key, {
    onlyIf: request.headers,
    range: request.headers
  })
  if (object === null) return notFound()

  const headers = new Headers()
  writeObjectHeaders(object, headers)

  if (!('body' in object)) {
    return new Response(null, {
      status: failedPreconditionStatus(request.headers),
      headers
    })
  }

  let status = 200
  let contentLength = object.size
  if (request.headers.has('range') && object.range !== undefined) {
    const range = resolveRange(object.range, object.size)
    status = 206
    contentLength = range.length
    headers.set(
      'content-range',
      `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`
    )
  }
  headers.set('content-length', String(contentLength))

  return new Response(request.method === 'HEAD' ? null : object.body, {
    status,
    headers
  })
}

export default {
  async fetch(request, env): Promise<Response> {
    const route = matchRoute(new URL(request.url).pathname, env)
    if (route === null) return notFound()
    if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed()
    return fetchObject(request, route.bucket, route.key)
  }
} satisfies ExportedHandler<Env>
