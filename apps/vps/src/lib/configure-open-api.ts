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

const toOpenApiPath = (path: string) =>
  `/auth${path.replaceAll(/:([^/]+)/g, '{$1}')}`

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

    document.paths = {
      ...document.paths,
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
