# OpenTelemetry Production Readiness Implementation

## Current Status: In Progress

### Completed Items

#### 1. OpenTelemetry SDK Initialization (Imperative Approach)
Due to type incompatibilities between `@effect/opentelemetry` and the main Effect package (the Effect layer provided a `Resource` type that couldn't be merged with service layers), we switched to an imperative OpenTelemetry initialization.

**File: `apps/vps/src/lib/otel.ts`**
- Initializes `NodeTracerProvider` on module load
- Configured with environment-based exporter switching:
  - Development: `ConsoleSpanExporter` with `SimpleSpanProcessor`
  - Production: `OTLPTraceExporter` with `BatchSpanProcessor`
- Configurable sampling via `OTEL_SAMPLING_RATE` env var (defaults to 10% in production, 100% in development)
- Resource attributes include service name, version, and deployment environment

**Environment Variables:**
- `NODE_ENV` - Controls development vs production behavior
- `OTEL_EXPORTER_OTLP_ENDPOINT` - URL for OTLP collector (required for production export)
- `OTEL_SAMPLING_RATE` - Optional sampling rate override (0.0-1.0)

#### 2. Entry Point Integration
**File: `apps/vps/src/index.ts`**
- OTel initialization is imported at the top to ensure tracing is set up before any other code runs

#### 3. Runtime Configuration
**Files:**
- `apps/vps/src/runtime/services.ts` - Service layer unchanged (no OTel layer merge needed)
- `apps/vps/src/runtime/index.ts` - ManagedRuntime unchanged

### Packages Installed
```json
{
  "@effect/opentelemetry": "^0.60.0",
  "@opentelemetry/exporter-trace-otlp-http": "0.210.0",
  "@opentelemetry/sdk-metrics": "^2.4.0",
  "@opentelemetry/sdk-trace-base": "2.4.0",
  "@opentelemetry/sdk-trace-node": "2.4.0"
}
```

### Existing Span Coverage

Services that already have `Effect.withSpan`:
- `favorite.service.ts` - Full span coverage with attributes
- `music-reminder.service.ts` - Full span coverage with attributes

Services with `Effect.annotateCurrentSpan` (annotations only, no wrapping spans):
- `audio.service.ts` - Partial annotations in `createEffect`
- `post.service.ts` - Annotations in `getByTagEffect` and `createEffect`

### Remaining Work

#### High Priority
1. **Add `Effect.withSpan` wrappers to services** - The annotations are present but won't be captured without parent spans
   - `audio.service.ts` - Add spans to `getByType`, `getBySlug`, `create`, `update`
   - `post.service.ts` - Add spans to `getByTag`, `create`
   - `label.service.ts` - Add spans to all methods
   - `release.service.ts` - Add spans to all methods
   - `spotify.service.ts` - Add spans to external API calls
   - `s3.service.ts` - Add spans to `uploadFile`, `deleteFile`
   - `publication.service.ts` - Add spans to key operations
   - `user.service.ts` - Add spans to user operations
   - `email.service.ts` - Add spans to email sending

2. **HTTP Auto-Instrumentation** - Add automatic request/response tracing
   - Consider `@opentelemetry/instrumentation-http` or Hono middleware

#### Low Priority
3. **Metrics Collection** - Add `@effect/opentelemetry` metrics setup
4. **Trace Context Propagation** - For distributed tracing across services

### Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `OTEL_EXPORTER_OTLP_ENDPOINT` to your collector URL (e.g., Jaeger, Tempo, Datadog)
- [ ] Configure `OTEL_SAMPLING_RATE` based on traffic volume
- [ ] Verify traces appear in your observability backend
- [ ] Monitor trace export errors in logs

### Architecture Decision: Imperative vs Effect Layer

We attempted to use `@effect/opentelemetry`'s `NodeSdk.layer()` but encountered type incompatibilities:

```typescript
// This approach failed due to Layer type mismatch:
const TracedAppLayer = AppLayer.pipe(Layer.provideMerge(NodeSdkLive))
// Error: Layer<Resource, never, never> not assignable to Layer<unknown, unknown, unknown>
```

The imperative approach (`NodeTracerProvider` initialization) works correctly with Effect's `Effect.withSpan` and `Effect.annotateCurrentSpan` because the OpenTelemetry context propagation happens at the runtime level, not the Effect layer level.

### Testing Locally

**Option 1: Console output (default)**
1. Run the dev server: `bun dev`
2. Make API requests
3. Observe span output in console (with `ConsoleSpanExporter`)

**Option 2: Visual tracing with Grafana Tempo**

The project includes a pre-configured observability stack with Grafana Tempo for trace visualization.

1. Start the observability stack from SST dev console: Run `Otel_Stack`
   - Or manually: `docker compose up tempo grafana prometheus loki promtail -d`
2. Set the environment variable: `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`
3. Start the VPS app: `bun dev`
4. Make API requests to generate traces
5. View traces at http://localhost:3000 (Grafana) → Explore → Select "Tempo" datasource

The stack includes:
- **Tempo** (port 3200): Trace storage and query backend
- **Grafana** (port 3000): Visualization UI (default password: admin123)
- **Prometheus** (port 9090): Metrics collection
- **Loki** (port 3100): Log aggregation
