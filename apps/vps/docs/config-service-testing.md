# ConfigService Architecture Guide

The application now uses a unified `ConfigService` that provides all configuration through Effect's dependency injection system. This replaces global environment variables with explicit, testable dependencies.

## Architecture Overview

### Synchronous Access (Module Initialization)
For module-level initialization that can't use Effect:

```typescript
import { config } from '@/services/config.service'

// Use synchronously at module load time
const dbClient = new DatabaseClient(config.database)
```

### Effect-Based Access (Services & Handlers)
For Effect-based code, yield the ConfigService:

```typescript
import { ConfigService } from '@/services/config.service'

const program = Effect.gen(function* () {
  const config = yield* ConfigService
  // Use config values
})
```

## Testing with ConfigService

### Basic Test Setup

```typescript
import { ConfigService } from '@/services/config.service'
import { Layer } from 'effect'

// Create a test config layer
const testConfigLayer = Layer.succeed(ConfigService, {
  database: {
    host: 'localhost',
    port: 5432,
    user: 'test_user',
    password: 'test_password',
    name: 'test_db'
  },
  urls: {
    frontend: 'http://localhost:3000',
    router: 'http://localhost:3001',
    bucketRouter: 'http://localhost:3001'
  },
  auth: {
    emailSender: 'test@example.com',
    accessTokenSecret: 'test-secret',
    refreshTokenSecret: 'test-secret',
    betterAuthSecret: 'test-auth-secret',
    betterAuthUrl: 'http://localhost:3001/auth'
  },
  spotify: {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret'
  },
  buckets: {
    userContent: 'test-user-content-bucket',
    databaseBackups: 'test-backup-bucket'
  },
  tasks: {
    databaseBackup: 'arn:aws:ecs:us-east-1:123456789012:task/test-backup-task'
  },
  app: {
    stage: 'test',
    nodeEnv: 'test',
    dbStage: 'test',
    logLevel: 'debug'
  },
  resources: {
    available: false // SST not available in tests
  }
})
```

## Testing Services with Config Dependencies

### Example: Testing S3Service with Config

```typescript
import { S3Service, S3ServiceLive } from '@/services/s3.service'
import { ConfigService } from '@/services/config.service'
import { Effect, Layer } from 'effect'

describe('S3Service', () => {
  const testLayer = Layer.mergeAll(
    testConfigLayer,  // Provide test config
    S3ServiceLive     // Service that depends on config
  )

  it('should upload file with correct bucket name', () => {
    const program = Effect.gen(function* () {
      const s3Service = yield* S3Service
      const config = yield* ConfigService

      // Verify the service uses config values
      expect(config.buckets.userContent).toBe('test-user-content-bucket')

      // Test the actual service (would need mocking for real S3)
      // const result = yield* s3Service.uploadFile('test-key', buffer, 'text/plain', config.buckets.userContent)
    })

    Effect.runPromise(program.pipe(Effect.provide(testLayer)))
  })
})
```

## Environment-Specific Testing

### Development Config
```typescript
const devConfigLayer = Layer.succeed(ConfigService, {
  // ... dev-specific values
  database: { host: 'localhost', port: 5432, ... },
  app: { stage: 'dev', nodeEnv: 'development' },
  resources: { available: true } // SST available in dev
})
```

### Production Config
```typescript
const prodConfigLayer = Layer.succeed(ConfigService, {
  // ... prod-specific values
  database: { host: 'prod-db-host', port: 5432, ... },
  app: { stage: 'prod', nodeEnv: 'production' },
  resources: { available: true }
})
```

## Testing Route Handlers

```typescript
import { uploadFile } from '@/routes/upload/upload.handlers'
import { Effect } from 'effect'

describe('Upload Route', () => {
  it('should handle file upload with test config', async () => {
    // Create a test Effect that provides all dependencies
    const testProgram = Effect.gen(function* () {
      // Mock Hono context and other dependencies
      // Test the uploadFile handler with test config
    })

    const result = await Effect.runPromise(
      testProgram.pipe(Effect.provide(testLayer))
    )

    expect(result).toBeDefined()
  })
})
```

## Integration Testing with Real Services

```typescript
// For integration tests that need real database
const integrationConfigLayer = Layer.succeed(ConfigService, {
  database: {
    host: 'localhost',
    port: 5433, // Different port for integration tests
    user: 'integration_user',
    password: 'integration_password',
    name: 'integration_db'
  },
  // ... other config with integration values
  app: { stage: 'integration', nodeEnv: 'test' },
  resources: { available: false }
})

// Use in integration test
describe('Database Integration', () => {
  const integrationLayer = Layer.mergeAll(
    integrationConfigLayer,
    DatabaseServiceLive, // Real database service
    // Other real services
  )

  beforeAll(async () => {
    // Setup integration database
    await setupIntegrationDatabase()
  })

  it('should perform real database operations', () => {
    const program = Effect.gen(function* () {
      const db = yield* DatabaseService
      // Test real database operations
    })

    Effect.runPromise(program.pipe(Effect.provide(integrationLayer)))
  })
})
```

## Testing Configuration Validation

```typescript
import { ConfigServiceLive } from '@/services/config.service'

describe('Config Validation', () => {
  it('should validate required fields', () => {
    // Test that invalid config throws validation errors
    const invalidConfig = {
      // Missing required fields
      database: { host: 'localhost' }, // Missing port, user, etc.
    }

    expect(() => {
      Layer.succeed(ConfigService, invalidConfig as any)
    }).toThrow() // Effect Schema validation error
  })

  it('should accept valid configuration', () => {
    const validConfig = createValidTestConfig()

    const layer = Layer.succeed(ConfigService, validConfig)
    expect(layer).toBeDefined()
  })
})
```

## Advanced: Dynamic Config for A/B Testing

```typescript
// Create config based on test parameters
function createABTestConfig(variant: 'A' | 'B') {
  const baseConfig = createValidTestConfig()

  if (variant === 'A') {
    return {
      ...baseConfig,
      auth: { ...baseConfig.auth, accessTokenSecret: 'secret-a' }
    }
  } else {
    return {
      ...baseConfig,
      auth: { ...baseConfig.auth, accessTokenSecret: 'secret-b' }
    }
  }
}

describe('A/B Testing', () => {
  it.each(['A', 'B'] as const)('should work with variant %s', (variant) => {
    const configLayer = Layer.succeed(ConfigService, createABTestConfig(variant))

    const program = Effect.gen(function* () {
      const config = yield* ConfigService
      // Test different behaviors based on config
    })

    Effect.runPromise(program.pipe(Effect.provide(configLayer)))
  })
})
```

## Migration Benefits

### Before (Global env.ts)
```typescript
// Tight coupling, hard to test
import { env } from '@/env'
const bucketName = env.USER_CONTENT_BUCKET_NAME
```

### After (Service Injection)
```typescript
// Effect-based (recommended)
const program = Effect.gen(function* () {
  const config = yield* ConfigService
  const bucketName = config.buckets.userContent
})

// Synchronous (when Effect not available)
import { config } from '@/services/config.service'
const bucketName = config.buckets.userContent
```

## When to Use Each Access Pattern

### Use `yield* ConfigService` (Effect-based):
- ✅ Inside Effect.gen functions
- ✅ Route handlers and middleware
- ✅ Service methods
- ✅ Any code that can be async

### Use `config` singleton (Synchronous):
- ⚠️ Module-level initialization
- ⚠️ Constructor parameters
- ⚠️ Third-party library setup
- ⚠️ Only when Effect context unavailable

## Advanced: Environment-Specific Layers

```typescript
// Development config
const devConfig = Layer.succeed(ConfigService, {
  ...baseConfig,
  database: { host: 'localhost', ... },
  app: { stage: 'dev', nodeEnv: 'development' },
  resources: { available: true }
})

// Production config
const prodConfig = Layer.succeed(ConfigService, {
  ...baseConfig,
  database: { host: process.env.DB_HOST, ... },
  app: { stage: 'prod', nodeEnv: 'production' },
  resources: { available: true }
})

// Integration test config
const integrationConfig = Layer.succeed(ConfigService, {
  ...baseConfig,
  database: { host: 'integration-db', ... },
  app: { stage: 'integration', nodeEnv: 'test' },
  resources: { available: false }
})
```

## Benefits Over Global Environment Variables

1. **Explicit Dependencies**: Tests clearly show what config they need
2. **Type Safety**: Full TypeScript validation of config structure
3. **Isolation**: Each test can have its own config without environment pollution
4. **Composability**: Easy to combine different config layers
5. **Validation**: Effect Schema ensures config correctness
6. **Mocking**: Simple to mock config for unit tests
7. **Single Source of Truth**: All config access goes through validated service
8. **SST Compatibility**: Gracefully handles presence/absence of SST resources

## Migration Path

When migrating from global `env` imports:

```typescript
// OLD: Global import
import { env } from '@/env'
const bucketName = env.USER_CONTENT_BUCKET_NAME

// NEW: Service injection
const program = Effect.gen(function* () {
  const config = yield* ConfigService
  const bucketName = config.buckets.userContent
})
```

For synchronous contexts (like module initialization), use the synchronous `createConfig()`:

```typescript
// For module-level initialization
import { createConfig } from '@/services/config.service'
const config = createConfig()
const client = new SomeClient(config.database.host)
```