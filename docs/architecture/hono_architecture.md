# Hono Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [App Creation & Router Setup](#app-creation--router-setup)
3. [Zod Validation Integration](#zod-validation-integration)
4. [OpenAPI Schema Generation](#openapi-schema-generation)
5. [Route Structure & Organization](#route-structure--organization)
6. [Middleware Architecture](#middleware-architecture)
7. [Type Safety & Type Flow](#type-safety--type-flow)
8. [Best Practices](#best-practices)

---

## Overview

The VPS API is built using [Hono](https://hono.dev) with OpenAPI support via `@hono/zod-openapi`. This architecture provides:

- **Type-safe API routes** with Zod schema validation
- **Auto-generated OpenAPI documentation** accessible via Scalar UI
- **Clean separation of concerns** with routes, handlers, and utilities
- **Built-in middleware** for CORS, logging, authentication, and error handling
- **Full TypeScript support** with end-to-end type safety

### Key Dependencies

```json
{
  "hono": "4.9.10",
  "@hono/zod-openapi": "^1.1.3",
  "stoker": "^2.0.1",
  "zod": "4.1.11",
  "drizzle-orm": "0.44.6"
}
```

---

## App Creation & Router Setup

### Core App Factory (`create-app.ts`)

The application is built using two factory functions:

#### 1. `createRouter()`

Creates an OpenAPIHono instance with custom validation error handling:

```typescript
import { OpenAPIHono } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: result.success,
            error: {
              issues: result.error.issues
            }
          },
          HttpStatusCodes.UNPROCESSABLE_ENTITY
        )
      }
    }
  })
}
```

**Key Features:**
- `AppBindings` type defines context variables (user, logger)
- `defaultHook` intercepts Zod validation failures
- Returns structured error responses with validation issues
- `strict: false` allows flexible routing

#### 2. `createApp()`

Configures the main application with middleware:

```typescript
export default function createApp() {
  const app = createRouter()

  // CORS configuration
  app.use(
    '*',
    cors({
      origin: [
        'http://127.0.0.1:5173',
        'http://localhost:4173',
        'http://127.0.0.1:3003',
        'https://www.goosebumps.fm',
        'https://goosebumps.fm'
      ],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowHeaders: ['Content-Type', 'Authorization', 'Refresh-Token'],
      credentials: true
    })
  )

  // Chain middleware
  app.use(requestId()).use(serveEmojiFavicon('🪿')).use(pinoLogger())

  // Error handlers
  app.notFound(notFound)
  app.onError(onError)

  return app
}
```

**Middleware Stack:**
1. **CORS** - Cross-origin resource sharing with specific origins
2. **Request ID** - Unique ID for request tracing
3. **Emoji Favicon** - Fun touch with a goose emoji
4. **Pino Logger** - Structured logging
5. **Error Handlers** - 404 and error responses

### Main App Entry (`app.ts`)

The main app assembles all routes:

```typescript
import createApp from '@/lib/create-app'
import configureOpenAPI from '@/lib/configure-open-api'
import auth from '@/routes/auth/auth.index'
import content from '@/routes/content/content.index'
// ... other imports

const app = createApp()

// Configure OpenAPI documentation
configureOpenAPI(app)

// Register route modules
const routes = [
  { path: '/auth', handler: auth },
  { path: '/content', handler: content },
  { path: '/publication', handler: publication },
  { path: '/spotify', handler: spotify },
  { path: '/upload', handler: upload },
  { path: '', handler: rss }
] as const

routes.forEach((route) => {
  app.route(route.path, route.handler)
})

// Health check
app.get('/health', async (c) => {
  await db.execute(sql.raw('SELECT 1'))
  return c.json({ dbConnected: true })
})

export default app
```

---

## Zod Validation Integration

### Schema Definition in Database Schemas

Zod schemas are co-located with Drizzle database schemas:

```typescript
// author.schema.ts
import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { z } from 'zod/v4'

// Database table
export const authorsTable = pgTable('authors', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  username: varchar({ length: 255 }).unique(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }),
  // ... other fields
})

// Zod validation schemas
export const signupSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.email(),
  password: z.string().min(8)
})

export const signinSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
})
```

### Using Schemas in Routes

Routes use Zod schemas for request/response validation:

```typescript
import { createRoute, z } from '@hono/zod-openapi'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'

export const signin = createRoute({
  path: '/signin',
  method: 'post',
  request: {
    body: jsonContentRequired(signinSchema, 'User signin data')
  },
  tags: ['Auth'],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      authResponseSchema,
      'Successful authentication'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid credentials'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(signinSchema),
      'Validation error'
    )
  }
})
```

**Key Helpers:**
- `jsonContentRequired()` - Marks request body as required
- `jsonContent()` - Defines response schema
- `createErrorSchema()` - Generates validation error response schema

### Accessing Validated Data in Handlers

Handlers access validated data using `c.req.valid()`:

```typescript
export const signup: AppRouteHandler<SignupRoute> = async (c) => {
  // This is already validated against signupSchema
  const validated = c.req.valid('json')

  // TypeScript knows the exact shape:
  // validated.username: string
  // validated.email: string
  // validated.password: string

  // Use validated data safely
  const hashedPassword = await Bun.password.hash(validated.password)

  const [newAuthor] = await db
    .insert(authorsTable)
    .values({
      username: validated.username || validated.email,
      password: hashedPassword,
      email: validated.email
    })
    .returning()

  // Return response matching schema
  return c.json(
    {
      message: 'Signup successful',
      user: authorWithoutPassword
    },
    HttpStatusCodes.CREATED
  )
}
```

---

## OpenAPI Schema Generation

### Configuration (`configure-open-api.ts`)

OpenAPI documentation is configured with Scalar UI:

```typescript
import { Scalar } from '@scalar/hono-api-reference'
import { version } from '../../../../package.json'

export default function configureOpenAPI(app: AppOpenAPI) {
  // Generate OpenAPI JSON
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version,
      title: 'GBFM VPS API'
    }
  })

  // Serve interactive documentation
  app.get(
    '/reference',
    Scalar({
      url: '/doc',
      theme: 'kepler',
      layout: 'classic',
      defaultHttpClient: {
        targetKey: 'js',
        clientKey: 'fetch'
      }
    })
  )
}
```

**Endpoints:**
- `/doc` - Raw OpenAPI JSON specification
- `/reference` - Interactive Scalar UI documentation

### How Routes Become OpenAPI

Each `createRoute()` call automatically generates OpenAPI:

```typescript
export const signup = createRoute({
  path: '/signup',           // → OpenAPI path
  method: 'post',           // → OpenAPI method
  request: {
    body: jsonContentRequired(signupSchema, 'User signup data')
  },                        // → OpenAPI request body
  tags: ['Auth'],          // → OpenAPI tags
  responses: {             // → OpenAPI responses
    [HttpStatusCodes.CREATED]: jsonContent(
      responseSchema,
      'User created successfully'
    )
  }
})
```

This generates:

```yaml
paths:
  /auth/signup:
    post:
      tags:
        - Auth
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SignupSchema'
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
```

---

## Route Structure & Organization

### File Structure Pattern

Each route module follows this structure:

```
routes/
├── auth/
│   ├── auth.index.ts      # Router assembly
│   ├── auth.routes.ts     # Route definitions
│   ├── auth.handlers.ts   # Handler implementations
│   └── auth.util.ts       # Helper functions
├── content/
│   ├── content.index.ts
│   ├── content.routes.ts
│   ├── content.handlers.ts
│   ├── label.routes.ts    # Sub-resource routes
│   ├── label.handlers.ts
│   ├── release.routes.ts
│   └── release.handlers.ts
└── spotify/
    ├── spotify.index.ts
    ├── spotify.routes.ts
    ├── spotify.handlers.ts
    └── spotify.types.ts
```

### Route Definition File (`.routes.ts`)

Defines the route configuration with schemas:

```typescript
// auth.routes.ts
import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'
import { authenticate } from '@/middlewares/auth.middleware'

const tags = ['Auth']

// Response schemas
const authResponseSchema = z.object({
  user: selectAuthorSchemaV4.omit({ password: true }),
  accessToken: z.string(),
  refreshToken: z.string()
})

export const signin = createRoute({
  path: '/signin',
  method: 'post',
  request: {
    body: jsonContentRequired(signinSchema, 'User signin data')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      authResponseSchema,
      'Successful authentication'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid credentials'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(signinSchema),
      'Validation error'
    )
  }
})

// Protected route with middleware
export const updateProfile = createRoute({
  path: '/profile',
  method: 'patch',
  middleware: [authenticate],  // ← Middleware applied here
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateProfileSchema
        },
        'multipart/form-data': {
          schema: z.object({
            name: z.string().optional(),
            avatar: z.instanceof(File).optional()
          })
        }
      }
    }
  },
  tags,
  responses: { /* ... */ }
})

// Export types for handlers
export type SigninRoute = typeof signin
export type UpdateProfileRoute = typeof updateProfile
```

### Handler Implementation File (`.handlers.ts`)

Implements the business logic:

```typescript
// auth.handlers.ts
import type { AppRouteHandler } from '@/lib/types'
import type { SigninRoute, UpdateProfileRoute } from './auth.routes'

export const signin: AppRouteHandler<SigninRoute> = async (c) => {
  // Get validated data
  const validated = c.req.valid('json')

  // Business logic
  const author = await getAuthorByEmailOrId({ email: validated.email })

  if (author.length === 0 || !author[0]?.password) {
    return c.json(
      { error: 'Invalid username or password' },
      HttpStatusCodes.UNAUTHORIZED
    )
  }

  const isPasswordValid = await Bun.password.verify(
    validated.password,
    author[0].password
  )

  if (!isPasswordValid) {
    return c.json(
      { error: 'Invalid username or password' },
      HttpStatusCodes.UNAUTHORIZED
    )
  }

  // Generate tokens
  const accessToken = await sign(
    { sub: author[0].id, type: 'access', exp: now + 900 },
    env.ACCESS_TOKEN_SECRET
  )

  const refreshToken = await sign(
    { sub: author[0].id, type: 'refresh', exp: now + 604800 },
    env.REFRESH_TOKEN_SECRET
  )

  // Save session
  await db.insert(authorSessionsTable).values({
    authorId: author[0].id,
    refreshToken,
    expiresAt: new Date(Date.now() + 604800000)
  })

  // Return typed response
  return c.json(
    {
      user: authorWithoutPassword,
      accessToken,
      refreshToken
    },
    HttpStatusCodes.OK
  )
}

export const updateProfile: AppRouteHandler<UpdateProfileRoute> = async (c) => {
  // Access authenticated user from context
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  // Handle multipart/form-data
  const contentType = c.req.header('content-type') || ''
  let updateData = {}

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData()
    // Process form data...
  } else {
    updateData = c.req.valid('json')
  }

  // Update in database
  const [updated] = await db
    .update(authorsTable)
    .set(updateData)
    .where(eq(authorsTable.id, user.id))
    .returning()

  return c.json(updated, HttpStatusCodes.OK)
}
```

### Router Assembly File (`.index.ts`)

Assembles routes with handlers:

```typescript
// auth.index.ts
import { createRouter } from '@/lib/create-app'
import * as handlers from './auth.handlers'
import * as routes from './auth.routes'

const router = createRouter()
  .openapi(routes.signup, handlers.signup)
  .openapi(routes.signin, handlers.signin)
  .openapi(routes.forgotPassword, handlers.forgotPassword)
  .openapi(routes.resetPassword, handlers.resetPassword)
  .openapi(routes.refreshToken, handlers.refreshToken)
  .openapi(routes.updateProfile, handlers.updateProfile)
  .openapi(routes.getProfile, handlers.getProfile)

export default router
```

**Pattern Benefits:**
- Clear separation of concerns
- Easy to test handlers independently
- Routes are self-documenting
- Type safety across the stack

---

## Middleware Architecture

### Type Definitions (`types.ts`)

Define app bindings for context variables:

```typescript
import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi'
import type { PinoLogger } from 'hono-pino'
import type { SelectAuthor } from '@/db/author.schema'

export interface AppBindings {
  Variables: {
    logger: PinoLogger
    user: Omit<SelectAuthor, 'password'>
  }
}

export type AppOpenAPI<S extends Schema = Schema> = OpenAPIHono<AppBindings, S>

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
  R,
  AppBindings
>
```

**Context Variables:**
- `logger` - Pino logger instance
- `user` - Authenticated user (set by auth middleware)

### Authentication Middleware

```typescript
// auth.middleware.ts
import type { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import type { AppBindings } from '@/lib/types'

export const authenticate = async (c: Context<AppBindings>, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization header required' }, 401)
  }

  const token = authHeader.substring(7)

  try {
    const payload = await verify(token, env.ACCESS_TOKEN_SECRET)

    if (payload.type !== 'access') {
      return c.json({ error: 'Invalid token type' }, 401)
    }

    const authorId = payload.sub
    const author = await getAuthorByEmailOrId({ authorId })

    if (!author[0]) {
      return c.json({ error: 'User not found' }, 404)
    }

    const { password, ...authorWithoutPassword } = author[0]

    // Set user in context
    c.set('user', authorWithoutPassword)

    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
}
```

### Using Middleware in Routes

Apply middleware at route definition:

```typescript
export const updateProfile = createRoute({
  path: '/profile',
  method: 'patch',
  middleware: [authenticate],  // ← Applied here
  // ... rest of route
})
```

Or apply to all routes in a module:

```typescript
const router = createRouter()

// Apply to all routes
router.use('*', authenticate)

router
  .openapi(routes.getProfile, handlers.getProfile)
  .openapi(routes.updateProfile, handlers.updateProfile)
```

### Logging Middleware

Pino logger is configured globally:

```typescript
// pino-logger.ts
import { pinoLogger as hpino } from 'hono-pino'
import pino from 'pino'
import pretty from 'pino-pretty'

export function pinoLogger() {
  return hpino({
    pino: pino(
      {
        level: process.env.LOG_LEVEL || 'info'
      },
      pretty({
        colorize: true
      })
    ),
    http: {
      reqId: () => crypto.randomUUID()
    }
  })
}
```

Access logger in handlers:

```typescript
export const someHandler: AppRouteHandler<SomeRoute> = async (c) => {
  const logger = c.get('logger')

  logger.info('Processing request')
  logger.error({ err: error }, 'Operation failed')

  // ...
}
```

---

## Type Safety & Type Flow

### End-to-End Type Flow

```typescript
// 1. Define Zod schema
export const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string())
})

// 2. Infer TypeScript type
export type CreatePostSchema = z.infer<typeof createPostSchema>

// 3. Define route with schema
export const createPost = createRoute({
  path: '/post',
  method: 'post',
  request: {
    body: jsonContentRequired(createPostSchema, 'The post to create')
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      postResponseSchema,
      'The created post'
    )
  }
})

// 4. Export route type
export type CreatePostRoute = typeof createPost

// 5. Handler uses route type
export const createPost: AppRouteHandler<CreatePostRoute> = async (c) => {
  // TypeScript knows exact shape!
  const validated = c.req.valid('json')
  // validated.title: string ✓
  // validated.content: string ✓
  // validated.tags: string[] ✓

  // Response must match postResponseSchema
  return c.json(newPost, HttpStatusCodes.CREATED)
}
```

### Type Utilities

```typescript
// AppRouteHandler provides full type safety
export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
  R,
  AppBindings
>

// Usage in handlers
export const handler: AppRouteHandler<MyRoute> = async (c) => {
  // c.req.valid() is typed based on route request schema
  // c.json() enforces response schema
  // c.get('user') returns Omit<SelectAuthor, 'password'>
  // c.get('logger') returns PinoLogger
}
```

### Parameter Validation

```typescript
// Define param schema
const idParamsSchema = z.object({
  id: z.uuid()
})

// Use in route
export const getById = createRoute({
  path: '/{id}',
  method: 'get',
  request: {
    params: idParamsSchema
  },
  // ...
})

// Handler receives typed params
export const getById: AppRouteHandler<GetByIdRoute> = async (c) => {
  const { id } = c.req.valid('param')
  // id: string (validated as UUID) ✓
}
```

### Query Parameter Validation

```typescript
const listQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional()
})

export const list = createRoute({
  path: '/',
  method: 'get',
  request: {
    query: listQuerySchema
  },
  // ...
})

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const { limit, offset, search } = c.req.valid('query')
  // limit: number ✓
  // offset: number ✓
  // search: string | undefined ✓
}
```

---

## Best Practices

### 1. Schema Organization

**✓ DO:** Co-locate Zod schemas with database schemas

```typescript
// author.schema.ts
export const authorsTable = pgTable('authors', { /* ... */ })

// Validation schemas in same file
export const signupSchema = z.object({ /* ... */ })
export const updateProfileSchema = z.object({ /* ... */ })
```

**✗ AVOID:** Separate schema files that duplicate definitions

### 2. Error Responses

**✓ DO:** Use consistent error response structure

```typescript
responses: {
  [HttpStatusCodes.BAD_REQUEST]: jsonContent(
    z.object({ error: z.string() }),
    'Invalid request'
  ),
  [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
    createErrorSchema(requestSchema),
    'Validation error'
  )
}
```

**✗ AVOID:** Inconsistent error formats

### 3. Handler Organization

**✓ DO:** Keep handlers focused and extract complex logic

```typescript
// Good: Extract to utility
export const uploadAvatar = async (file: File): Promise<string> => {
  // Complex S3 upload logic
}

export const updateProfile: AppRouteHandler<UpdateProfileRoute> = async (c) => {
  // Handler stays focused
  if (avatarFile) {
    updateData.avatarUrl = await uploadAvatar(avatarFile)
  }
}
```

**✗ AVOID:** Inline complex operations in handlers

### 4. Middleware Usage

**✓ DO:** Apply middleware at route definition for OpenAPI docs

```typescript
export const protectedRoute = createRoute({
  middleware: [authenticate],  // ← Documented in OpenAPI
  // ...
})
```

**✗ AVOID:** Applying middleware in index file (not documented)

### 5. Type Exports

**✓ DO:** Export route types for handlers

```typescript
// routes.ts
export const createPost = createRoute({ /* ... */ })
export type CreatePostRoute = typeof createPost

// handlers.ts
import type { CreatePostRoute } from './routes'
export const createPost: AppRouteHandler<CreatePostRoute> = async (c) => {
  // Fully typed
}
```

### 6. Response Status Codes

**✓ DO:** Use stoker's HTTP status code constants

```typescript
import * as HttpStatusCodes from 'stoker/http-status-codes'

return c.json(data, HttpStatusCodes.CREATED)  // ✓
return c.json(data, HttpStatusCodes.UNPROCESSABLE_ENTITY)  // ✓
```

**✗ AVOID:** Magic numbers

```typescript
return c.json(data, 201)  // ✗
return c.json(data, 422)  // ✗
```

### 7. Multipart Form Data

**✓ DO:** Support multiple content types when needed

```typescript
request: {
  body: {
    content: {
      'application/json': { schema: jsonSchema },
      'multipart/form-data': { schema: formSchema }
    }
  }
}
```

### 8. Database Operations

**✓ DO:** Return inserted/updated records

```typescript
const [newAuthor] = await db
  .insert(authorsTable)
  .values(data)
  .returning()  // ← Get created record

if (!newAuthor) {
  return c.json({ error: 'Failed to create' }, HttpStatusCodes.INTERNAL_SERVER_ERROR)
}
```

### 9. Security

**✓ DO:** Always omit sensitive fields from responses

```typescript
const { password, ...authorWithoutPassword } = author
return c.json(authorWithoutPassword)
```

**✓ DO:** Validate tokens properly

```typescript
const payload = await verify(token, secret)
if (payload.type !== 'access') {
  return c.json({ error: 'Invalid token type' }, 401)
}
```

### 10. Testing Support

**✓ DO:** Use `createTestApp` for testing

```typescript
// create-app.ts
export function createTestApp<S extends Schema>(router: AppOpenAPI<S>) {
  return createApp().route('/', router)
}

// tests
import { createTestApp } from '@/lib/create-app'
import authRouter from '@/routes/auth/auth.index'

const app = createTestApp(authRouter)
```

---

## Summary

The Hono architecture in this VPS API provides:

1. **Type-safe API development** with Zod validation at every layer
2. **Auto-generated OpenAPI docs** that stay in sync with code
3. **Clean code organization** with separation of routes, handlers, and utilities
4. **Powerful middleware system** for cross-cutting concerns
5. **Production-ready patterns** for authentication, logging, and error handling

### Quick Reference

```typescript
// 1. Define route
export const myRoute = createRoute({
  path: '/my-endpoint',
  method: 'post',
  middleware: [authenticate],
  request: { body: jsonContentRequired(mySchema, 'Description') },
  tags: ['MyTag'],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(responseSchema, 'Success')
  }
})
export type MyRoute = typeof myRoute

// 2. Implement handler
export const myHandler: AppRouteHandler<MyRoute> = async (c) => {
  const validated = c.req.valid('json')
  const user = c.get('user')
  const logger = c.get('logger')

  // Business logic...

  return c.json(result, HttpStatusCodes.OK)
}

// 3. Assemble router
const router = createRouter()
  .openapi(routes.myRoute, handlers.myHandler)

export default router

// 4. Register in app.ts
app.route('/my-module', router)
```

For more information:
- [Hono Documentation](https://hono.dev)
- [Zod Documentation](https://zod.dev)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.0)
- [Stoker Documentation](https://github.com/w3cj/stoker)
