# ConfigService Migration: From Global Env to Effect Services

## Overview

Successfully migrated the VPS application from global `env.ts` imports to a unified Effect-based `ConfigService`. This refactor enables better testability, type safety, and composability while maintaining compatibility with both SST and non-SST deployments.

## Migration Scope

**Before**: Global environment variable access via `env.ts`

```typescript
import { env } from '@/env'
const bucketName = env.USER_CONTENT_BUCKET_NAME
```

**After**: Effect service dependency injection

```typescript
const program = Effect.gen(function* () {
  const config = yield* ConfigService
  const bucketName = config.buckets.userContent
})
```

## Architecture

### ConfigService Structure

The unified `ConfigService` provides access to all application configuration:

```typescript
interface ConfigService {
  readonly database: {
    host: string
    port: number
    user: string
    password: string
    name: string
  }
  readonly urls: {
    frontend: string
    router: string
    bucketRouter: string
  }
  readonly auth: {
    emailSender: string
    accessTokenSecret: string
    refreshTokenSecret: string
    betterAuthSecret: string
    betterAuthUrl: string
  }
  readonly spotify: {
    clientId: string
    clientSecret: string
  }
  readonly buckets: {
    userContent: string
    mixes: string
  }
  readonly app: {
    stage: string
    nodeEnv: string
    dbStage?: string
    logLevel?: string
  }
  readonly resources: {
    available: boolean // SST availability flag
  }
}
```

### Access Patterns

**1. Effect-based (Recommended)**

```typescript
import { ConfigService } from '@/services/config.service'

const uploadHandler = Effect.gen(function* () {
  const config = yield* ConfigService
  const bucketName = config.buckets.userContent
  // ... rest of handler
})
```

**2. Synchronous (Module Initialization)**

```typescript
import { config } from '@/services/config.service'

const dbClient = new DatabaseClient(config.database)
const spotifyClient = SpotifyApiClient.withClientCredentials(
  config.spotify.clientId,
  config.spotify.clientSecret
)
```

## Files Migrated

### Services (3 files)

- ✅ `src/services/config.service.ts` - New unified config service
- ✅ `src/services/spotify.service.ts` - Synchronous config access
- ✅ `src/db/index.ts` - Synchronous config access

### Route Handlers & Middleware (3 files)

- ✅ `src/routes/upload/upload.handlers.ts` - Effect-based ConfigService yielding
- ✅ `src/routes/user/user.util.ts` - Synchronous config access
- ✅ `src/middlewares/effect-logger.ts` - Synchronous config access

### Libraries & Utilities (5 files)

- ✅ `src/lib/create-app.ts` - CORS config with synchronous access
- ✅ `src/lib/auth.ts` - Better Auth config with synchronous access
- ✅ `src/middlewares/pino-logger.ts` - Logger config with synchronous access
- ✅ `src/archive/seed-mixes.ts` - Archive seeding with synchronous access
- ✅ `src/db/query-timer.ts` - Query logging with synchronous access

### Configuration & Scripts (4 files)

- ✅ `drizzle.config.ts` & `drizzle.config.prod.ts` - Database migration configs
- Retired: `scripts/run-backup-task.ts` was removed when backup ownership moved to PlanetScale
- ✅ `scripts/db.ts` - Database connection script

### Infrastructure (1 file)

- ✅ `src/runtime/services.ts` - AppLayer includes ConfigServiceLive

## Key Features

### ✅ SST Compatibility

- Graceful fallback when SST resources unavailable
- `resources.available` flag indicates SST presence
- Environment variables take precedence over SST resources

### ✅ Effect Schema Validation

- Full type safety with Effect Schema
- Runtime validation of configuration structure
- Clear error messages for invalid config

### ✅ Testability

- Easy mock configuration via Effect Layers
- Isolated test environments without env pollution
- Explicit dependency declaration

## Benefits Achieved

1. **🧪 Testability**: Mock configs via Effect Layers
2. **🔒 Type Safety**: Schema-validated configuration
3. **🏗️ Composability**: Services declare config dependencies
4. **🌍 Environment Agnostic**: Works with/without SST
5. **📦 Single Source**: All config through validated service
6. **🔄 Maintainable**: Clear patterns for future additions

## Quality Assurance

- ✅ **TypeScript**: All packages compile without errors
- ✅ **Biome**: Code formatting and linting pass
- ✅ **Precommit**: All quality checks pass
- ✅ **SST Compatibility**: Verified works outside SST ecosystem

## Usage Guidelines

### When to Use Effect-based Access

- ✅ Route handlers and middleware
- ✅ Service methods with Effect.gen
- ✅ Any async/Effect context

### When to Use Synchronous Access

- ⚠️ Module-level initialization
- ⚠️ Third-party library constructors
- ⚠️ Synchronous configuration requirements

## Future Considerations

### Potential Enhancements

- **Environment-specific schemas**: Different validation rules per environment
- **Config hot-reloading**: Runtime config updates for development
- **Config encryption**: Secure handling of sensitive values
- **Config sources**: Support for config files, databases, remote services

### Monitoring & Observability

- **Config validation metrics**: Track config validation failures
- **Environment detection**: Monitor SST vs non-SST deployments
- **Config usage analytics**: Track which config values are accessed

## Migration Impact

- **Zero breaking changes** for end users
- **Improved developer experience** with better testing
- **Enhanced maintainability** with centralized config
- **Future-proof architecture** for config source expansion

This migration establishes a robust foundation for configuration management that scales with the application's growing complexity while maintaining the flexibility to run in any environment.</content>
<parameter name="filePath">docs/config-service-migration.md
