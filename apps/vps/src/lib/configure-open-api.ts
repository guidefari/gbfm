import { Scalar } from '@scalar/hono-api-reference'
import { auth } from '@/lib/auth'
import { version } from '../../../../package.json'

import type { AppOpenAPI } from './types'

type AuthEndpoint = {
  path?: string
  options?: {
    method?: string | string[]
    requireHeaders?: boolean
    metadata?: {
      openapi?: Record<string, unknown>
    }
  }
}

/**
 * Converts Hono-style path params (`:id`) to OpenAPI-style (`{id}`).
 * `@hono/zod-openapi` emits colon-prefixed params in the generated doc,
 * but Scalar (and other OpenAPI clients) expect braces to interpolate
 * path variables into the actual request URL.
 */
const colonToOpenApiBraces = (path: string) =>
  path.replaceAll(/:([^/]+)/g, '{$1}')

const toOpenApiPath = (path: string) => `/auth${colonToOpenApiBraces(path)}`

const toOpenApiMethod = (method: string) => method.toLowerCase()

const buildAuthPaths = () => {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const [key, value] of Object.entries(auth.api)) {
    const endpoint = value as AuthEndpoint
    if (!endpoint.path || !endpoint.options?.method) {
      continue
    }

    const methods = Array.isArray(endpoint.options.method)
      ? endpoint.options.method
      : [endpoint.options.method]

    const path = toOpenApiPath(endpoint.path)
    paths[path] ??= {}

    for (const method of methods) {
      const openapi = endpoint.options.metadata?.openapi ?? {}
      paths[path][toOpenApiMethod(method)] = {
        tags: ['Auth'],
        ...openapi,
        security: endpoint.options.requireHeaders
          ? [{ bearerAuth: [] }, { cookieAuth: [] }]
          : undefined,
        summary:
          (openapi.summary as string | undefined) ??
          (openapi.description as string | undefined) ??
          key
      }
    }
  }

  return paths
}

export default function configureOpenAPI(app: AppOpenAPI) {
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'Bearer'
  })
  app.openAPIRegistry.registerComponent('securitySchemes', 'cookieAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: 'better-auth.session_token'
  })

  app.get('/doc', (c) => {
    const document = app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: {
        version,
        title: 'GBFM VPS API'
      }
    })

    // Rewrite all generated paths from `:param` → `{param}` so Scalar
    // correctly substitutes path variables in its request client.
    const convertedPaths: typeof document.paths = {}
    for (const [path, value] of Object.entries(document.paths ?? {})) {
      convertedPaths[colonToOpenApiBraces(path)] = value
    }

    document.paths = {
      ...convertedPaths,
      ...buildAuthPaths()
    }

    return c.json(document)
  })

  app.get(
    '/reference',
    Scalar({
      url: '/doc',
      theme: 'kepler',
      layout: 'classic',
      persistAuth: true,
      authentication: {
        preferredSecurityScheme: ['bearerAuth', 'cookieAuth'],
        securitySchemes: {
          bearerAuth: {
            token: ''
          },
          cookieAuth: {
            value: ''
          }
        }
      },
      defaultHttpClient: {
        targetKey: 'js',
        clientKey: 'fetch'
      }
    })
  )
}
