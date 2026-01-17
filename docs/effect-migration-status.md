# Effect Migration Plan & Progress

## Overview

This document tracks the systematic migration of the VPS backend from imperative async/await patterns to Effect-based functional programming. The migration follows a phased approach to ensure stability while introducing type-safe, composable error handling and dependency injection.

## Migration Goals

- **Type Safety**: Full TypeScript inference with zero `any` types in business logic
- **Error Handling**: Tagged errors with automatic HTTP status code mapping
- **Service Architecture**: Layer-based dependency injection with proper resource management
- **Incremental Migration**: Zero breaking changes, deployable at each phase
- **Performance**: 60x reduction in service initialization overhead

## Current Status

### ✅ **Phase 1: Foundation** - Complete
- **Effect Handler Helper**: `apps/vps/src/lib/effect-handler.ts`
- **Error Types**: Extended error system with HTTP status mapping
- **Runtime Infrastructure**: ManagedRuntime with service layers

### ✅ **Phase 2: Simple Services** - Complete
- **FavoriteService**: Full Effect-based service implementation
- **MusicReminderService**: CRUD operations with authorization checks
- **Database Operations**: Type-safe CRUD with error handling
- **Handler Migration**: Favorites (3 routes) + Music Reminders (4 routes) migrated
- **Service Pattern**: `Layer.succeed` with pure Effects (R = never)

### ✅ **Phase 3: SpotifyService** - Complete
- **SpotifyService**: Complete Effect-based service with 5 methods
- **External API Integration**: Spotify Web API calls wrapped in Effect
- **URL Enrichment**: Multi-platform track enrichment (Spotify, YouTube, Apple Music)
- **Handler Migration**: 5 routes migrated with functional error handling
- **Type Safety**: Full TypeScript coverage for all operations

### ✅ **Phase 4: Content Services** - Complete
- **AudioService**: `getByType`, `getBySlug`, `create`, `update` with MDX compilation
- **PostService**: `getByTag`, `create` with transaction support
- **LabelService**: `getAll`, `getBySlug`, `create`, `update` with creator management
- **ReleaseService**: `getByLabelSlug`, `getBySlug`, `create`, `update`, `delete`
- **Transaction Patterns**: Multi-table operations with Effect

### 📋 **Phase 5: Remaining Services** - Planned
- **S3Service**: File upload/storage operations
- **PublicationService**: Content publication workflow
- **UserService**: Authentication and user management

### 📋 **Phase 6: Handler Migration** - Planned
- Content handlers can now be migrated to use AudioService, PostService, LabelService, ReleaseService
- Read-only routes (RSS, Share) - low priority

## Technical Achievements

### Architecture Pattern Established

```typescript
// Service Definition - Pure Effects with R = never
const addFavoriteEffect = (userId: string, audioId: string) =>
  Effect.gen(function* () {
    // Database operations with error handling
    const result = yield* Effect.tryPromise({ ... })
    return result
  })

// Service Layer - Static provision via Layer.succeed
export const FavoriteServiceLive = Layer.succeed(FavoriteService, {
  addFavorite: addFavoriteEffect,
  // ... other methods
})

// Handler Usage - Type-safe service access
const program = Effect.gen(function* () {
  const service = yield* FavoriteService  // ✅ Type-safe injection
  return yield* service.addFavorite(userId, audioId)
})
await runApp(program)  // ✅ Runtime provides service
```

### Type Safety Achievements

- ✅ **Zero `@ts-expect-error`** in business logic
- ✅ **Zero `any` types** in service and handler code
- ✅ **Full TypeScript inference** for all operations
- ✅ **Runtime type safety** maintained
- ⚠️ **Minimal `any` in runtime utilities** (necessary for Effect system compatibility)

### Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Service Initializations | 60/hour (cron) | 1 (startup) | **60x fewer** |
| Memory Usage | Constant GC | Stable | Lower pressure |
| Type Checking | Runtime errors | Compile-time | **100% safety** |
| Error Handling | Try/catch | Tagged unions | **Type-safe** |

## Challenges Resolved

### Circular Type Inference Issue
**Problem**: TypeScript incorrectly inferred circular dependencies between services and their methods.

**Solution**: Restructured services using `Layer.succeed` with pure Effects defined outside the layer context, eliminating type inference cycles.

### OpenAPI Strict Typing Conflict
**Problem**: Stoker's strict route typing conflicted with flexible Effect error handling.

**Solution**: Modified route schemas to use union types, allowing both success and error responses while maintaining OpenAPI compliance.

### Service Environment Dependencies
**Problem**: Effects requiring services in their environment caused type conflicts.

**Solution**: Ensured all service methods return Effects with `R = never` by using only database and external dependencies.

## Migration Checklist

### Services Completed
- [x] EmailService (existing)
- [x] FavoriteService (Phase 2)
- [x] MusicReminderService (Phase 2b)
- [x] SpotifyService (Phase 3)
- [x] AudioService (Phase 4)
- [x] PostService (Phase 4)
- [x] LabelService (Phase 4)
- [x] ReleaseService (Phase 4)

### Services Remaining
- [ ] S3Service (Phase 5)
- [ ] PublicationService (Phase 5)
- [ ] UserService (Phase 5)

### Routes Migrated
- [x] `/favorites/*` (3 routes - complete)
- [x] `/spotify/*` (5 routes - complete)
- [x] `/music-reminders/*` (4 routes - complete)

### Routes to Migrate (handlers can adopt new services)
- [ ] `/content/*` (8 routes) - services ready, handlers pending
- [ ] `/labels/*` (4 routes) - services ready, handlers pending
- [ ] `/releases/*` (5 routes) - services ready, handlers pending
- [ ] `/auth/*` (4 routes)
- [ ] `/upload/*` (3 routes)
- [ ] `/publication/*` (4 routes)
- [ ] `/rss/*` (read-only, low priority)
- [ ] `/share/*` (read-only, low priority)

## Implementation Patterns

### Service Definition Pattern
```typescript
// 1. Pure Effect functions (R = never)
const serviceMethodEffect = (params) => Effect.gen(function* () {
  // Business logic with error handling
})

// 2. Service interface
export interface Service {
  method: (params) => Effect.Effect<Result, Error>
}

// 3. Service implementation via Layer.succeed
export const ServiceLive = Layer.succeed(Service, {
  method: serviceMethodEffect
})
```

### Handler Pattern
```typescript
export const handler = async (c: Context) => {
  const program = Effect.gen(function* () {
    const service = yield* Service  // Type-safe injection
    return yield* service.method(params)
  })

  const result = await runApp(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404)
    }
    return c.json({ error: 'Internal error' }, 500)
  }

  return c.json(result.right)
}
```

### Error Handling Pattern
```typescript
// Tagged errors with automatic HTTP mapping
export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  message: string
  resource: string
  id: string
}> {}

// Usage in Effects
return yield* Effect.fail(new NotFoundError({ ... }))

// Pattern matching in handlers
if (error instanceof NotFoundError) return c.json({ error }, 404)
if (error instanceof UnauthorizedError) return c.json({ error }, 401)
if (error instanceof ConflictError) return c.json({ error }, 409)
```

## Next Steps

### Immediate (Phase 5)
1. **Implement S3Service** for file upload operations
2. **Implement PublicationService** for content workflow
3. **Implement UserService** for auth operations

### Short Term (Phase 6 - Handler Migration)
1. **Migrate content handlers** to use AudioService, PostService
2. **Migrate label handlers** to use LabelService
3. **Migrate release handlers** to use ReleaseService

### Long Term (Complete Migration)
1. **Remaining handlers** (auth, upload, publication)
2. **Advanced patterns**: Circuit breakers, retries, observability
3. **Testing infrastructure** with Effect-based test runtimes

## Success Metrics

- **Type Coverage**: 100% of business logic fully typed
- **Runtime Stability**: Zero regressions in existing functionality
- **Performance**: Measurable improvements in resource usage
- **Developer Experience**: Improved error handling and debugging
- **Maintainability**: Clear service boundaries and composability

## Files Reference

```
apps/vps/src/
├── runtime/
│   ├── index.ts              # ManagedRuntime & runApp (9 services)
│   └── services.ts           # AppLayer composition
├── services/
│   ├── email.service.ts      # ✅ Complete (existing)
│   ├── favorite.service.ts   # ✅ Complete (Phase 2)
│   ├── music-reminder.service.ts # ✅ Complete (Phase 2b)
│   ├── spotify.service.ts    # ✅ Complete (Phase 3)
│   ├── audio.service.ts      # ✅ Complete (Phase 4)
│   ├── post.service.ts       # ✅ Complete (Phase 4)
│   ├── label.service.ts      # ✅ Complete (Phase 4)
│   └── release.service.ts    # ✅ Complete (Phase 4)
├── errors.ts                 # Extended error types
├── routes/favorites/
│   └── favorites.handlers.ts # ✅ Migrated (Phase 2)
├── routes/spotify/
│   └── spotify.handlers.ts   # ✅ Migrated (Phase 3)
└── routes/music-reminders/
    └── music-reminders.handlers.ts # ✅ Migrated (Phase 2b)
```

---

**Last Updated**: January 18, 2026
**Current Phase**: 4 Complete, Phase 5 Next
**Migration Progress**: 8/11 services complete (73%)
