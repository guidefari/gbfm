import { matchRoute } from './route'
import { parseImageOptions, toContentType } from './image-options'

const imageCacheControl = 'public, max-age=31536000, immutable'

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD',
  'access-control-expose-headers': 'ETag'
}

const withCors = (response: Response) => {
  for (const [name, value] of Object.entries(corsHeaders)) {
    response.headers.set(name, value)
  }
  return response
}

const notFound = () => new Response(null, { status: 404 })

const methodNotAllowed = () =>
  new Response(null, {
    status: 405,
    headers: { Allow: 'GET, HEAD' }
  })

const writeObjectHeaders = (object: R2Object, headers: Headers) => {
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  if (object.httpMetadata?.contentType?.startsWith('image/') && !headers.has('cache-control')) {
    headers.set('cache-control', imageCacheControl)
  }
  for (const [name, value] of Object.entries(object.customMetadata ?? {})) {
    headers.set(`x-amz-meta-${name}`, value)
  }
}

const transformImage = async (
  object: R2ObjectBody,
  images: ImagesBinding,
  options: NonNullable<ReturnType<typeof parseImageOptions>>
) => {
  const [input, fallback] = object.body.tee()

  try {
    const transformed = await images
      .input(input)
      .transform({ width: options.width, fit: 'scale-down' })
      .output({ format: toContentType(options.format), quality: options.quality })
    const response = transformed.response()
    await fallback.cancel()
    const headers = new Headers(response.headers)
    headers.set('cache-control', imageCacheControl)
    headers.set('etag', `${object.httpEtag}-${options.width}-${options.quality}-${options.format}`)
    return new Response(response.body, { status: response.status, headers })
  } catch {
    const headers = new Headers()
    writeObjectHeaders(object, headers)
    return new Response(fallback, { headers })
  }
}

const resolveRange = (range: R2Range, objectSize: number) => {
  if ('suffix' in range && range.suffix !== undefined) {
    const length = Math.min(range.suffix, objectSize)
    return { offset: objectSize - length, length }
  }

  const offset = 'offset' in range && range.offset !== undefined ? range.offset : 0
  const length =
    'length' in range && range.length !== undefined ? range.length : objectSize - offset
  return { offset, length }
}

const failedPreconditionStatus = (headers: Headers) =>
  headers.has('if-none-match') || headers.has('if-modified-since') ? 304 : 412

const fetchObject = async (
  request: Request,
  bucket: R2Bucket,
  key: string,
  images: ImagesBinding
) => {
  const object = await bucket.get(key, {
    onlyIf: request.headers,
    range: request.headers
  })
  if (object === null) return withCors(notFound())

  const headers = new Headers()
  writeObjectHeaders(object, headers)

  if (!('body' in object)) {
    return withCors(
      new Response(null, {
        status: failedPreconditionStatus(request.headers),
        headers
      })
    )
  }

  const imageOptions = parseImageOptions(new URL(request.url))
  if (
    request.method === 'GET' &&
    imageOptions !== null &&
    object.httpMetadata?.contentType?.startsWith('image/')
  ) {
    return withCors(await transformImage(object, images, imageOptions))
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

  return withCors(
    new Response(request.method === 'HEAD' ? null : object.body, {
      status,
      headers
    })
  )
}

export default {
  async fetch(request, env): Promise<Response> {
    const route = matchRoute(new URL(request.url).pathname, env)
    if (route === null) return withCors(notFound())
    if (request.method !== 'GET' && request.method !== 'HEAD') return withCors(methodNotAllowed())
    return fetchObject(request, route.bucket, route.key, env.IMAGES)
  }
} satisfies ExportedHandler<Env>
