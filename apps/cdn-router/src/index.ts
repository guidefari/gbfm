import { parseImageOptions, toContentType } from './image-options'
import { approvedPreviewOrigin, hasPreviewCookie, previewSession, privateResponse } from './preview'
import { matchRoute } from './route'

const imageCacheControl = 'public, max-age=31536000, immutable'

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD',
  'access-control-expose-headers': 'ETag',
}

const withCors = (response: Response) => {
  for (const [name, value] of Object.entries(corsHeaders)) {
    response.headers.set(name, value)
  }

  // Uploaded documents must never execute with this origin's private-media cookies.
  // Apply even to legacy public objects and failed image-transform fallbacks.
  response.headers.set(
    'content-security-policy',
    "sandbox; default-src 'none'; style-src 'unsafe-inline'",
  )
  response.headers.set('x-content-type-options', 'nosniff')

  return response
}

const notFound = () => new Response(null, { status: 404 })

const methodNotAllowed = () =>
  new Response(null, {
    status: 405,
    headers: { Allow: 'GET, HEAD' },
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
  options: NonNullable<ReturnType<typeof parseImageOptions>>,
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
  images: ImagesBinding,
) => {
  const object = await bucket.get(key, {
    onlyIf: request.headers,
    range: request.headers,
  })

  if (object === null) return withCors(notFound())

  const headers = new Headers()
  writeObjectHeaders(object, headers)

  if (!('body' in object)) {
    return withCors(
      new Response(null, {
        status: failedPreconditionStatus(request.headers),
        headers,
      }),
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
      `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`,
    )
  }

  headers.set('content-length', String(contentLength))

  return withCors(
    new Response(request.method === 'HEAD' ? null : object.body, {
      status,
      headers,
    }),
  )
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/preview-session') return previewSession(request, env)
    const route = matchRoute(url.pathname, env)

    if (route === null) return withCors(notFound())

    // Decode only to reject reserved-prefix aliases, never to select an R2 object.
    // Existing public keys retain their literal path spelling and fast public path.
    if (!route.key.startsWith('private/') && route.key.includes('%')) {
      try {
        if (decodeURIComponent(route.key).startsWith('private/'))
          return privateResponse(notFound(), request, env)
      } catch {
        // Malformed escapes remain literal public R2 keys, as before.
      }
    }

    if (route.key.startsWith('private/')) {
      const reply = (response: Response) => privateResponse(response, request, env)

      if (
        /[\\%]/.test(url.pathname) ||
        route.key.split('/').some((part) => part === '' || part === '.' || part === '..')
      )
        return reply(notFound())

      if (!env.MEDIA_PREVIEW_KEY || !env.MEDIA_PREVIEW_ORIGIN)
        return reply(new Response(null, { status: 503 }))

      // /mixes must never be an unsigned alias, nor an alternate signed asset URL.
      if (!url.pathname.startsWith('/user-content/private/'))
        return reply(new Response(null, { status: 403 }))

      if (request.method === 'OPTIONS') {
        return reply(
          new Response(null, { status: approvedPreviewOrigin(request, env) !== null ? 204 : 403 }),
        )
      }

      if (!(await hasPreviewCookie(request, env.MEDIA_PREVIEW_KEY, url.origin, url.pathname)))
        return reply(new Response(null, { status: 403 }))

      if (request.method !== 'GET' && request.method !== 'HEAD') return reply(methodNotAllowed())

      try {
        return reply(await fetchObject(request, route.bucket, route.key, env.IMAGES))
      } catch {
        return reply(new Response(null, { status: 500 }))
      }
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') return withCors(methodNotAllowed())

    return fetchObject(request, route.bucket, route.key, env.IMAGES)
  },
} satisfies ExportedHandler<Env>
