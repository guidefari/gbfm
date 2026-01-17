# OpenTelemetry Implementation Guide

This document describes the vendor-neutral OpenTelemetry implementation for GBFM.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   VPS Service   │────▶│  OTEL Collector (ECS) │────▶│  Your Backend   │
│   (Hono App)    │     │                      │     │  (Honeycomb,    │
│                 │     │  - Receives OTLP     │     │   Jaeger,       │
│  - Traces       │     │  - Processes         │     │   Grafana, etc) │
│  - Metrics      │     │  - Filters           │     │                 │
│  - Logs         │     │  - Exports           │     │                 │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
```

## Key Features

- **Vendor Neutral**: Switch backends without changing application code
- **Automatic Instrumentation**: HTTP, PostgreSQL, AWS SDK automatically traced
- **Custom Metrics**: Business-specific metrics for mixes, emails, users
- **Effect Integration**: Full support for Effect-based code
- **Tail Sampling**: Smart sampling to reduce costs while keeping errors
- **Multi-Backend**: Send to multiple backends simultaneously

## Quick Start

### 1. Install Dependencies

```bash
cd apps/vps
bun add @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-metrics-otlp-http \
  @opentelemetry/sdk-metrics \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

### 2. Initialize Telemetry

Update `apps/vps/src/index.ts`:

```typescript
import { initializeTelemetry } from './lib/telemetry'

// Initialize BEFORE importing any other code
initializeTelemetry()

// Now import your app
import app from './app'
import { env } from './env'

export default {
  port: env.PORT,
  fetch: app.fetch
}
```

### 3. Update Create App

Update `apps/vps/src/lib/create-app.ts`:

```typescript
import { telemetryMiddleware } from '@/middlewares/telemetry'

export default function createApp() {
  const app = createRouter()

  app.use('*', cors(corsConfig))
  app.use(requestId())
    .use(telemetryMiddleware())  // Add this line
    .use(pinoLogger())
    .use(serveEmojiFavicon('🪿'))

  app.notFound(notFound)
  app.onError(onError)
  return app
}
```

### 4. Deploy Infrastructure

```bash
# Deploy the OTEL Collector
bun deploy

# The collector will be available at:
# http://otel-collector.local:4318 (from within ECS)
```

## Backend Configuration

The OTEL Collector supports multiple backends. Choose one or configure multiple.

### Option 1: Jaeger (Self-Hosted, Free)

**Pros**: Free, open-source, great UI, runs in your infrastructure
**Cons**: You manage it, limited retention

Update `otel-collector-config.yaml`:

```yaml
exporters:
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      exporters:
        - otlp/jaeger
```

Access Jaeger UI: `http://<jaeger-service-url>:16686`

### Option 2: Honeycomb (SaaS)

**Pros**: Excellent query interface, generous free tier, great for debugging
**Cons**: Can get expensive at scale

1. Sign up at https://honeycomb.io
2. Get your API key
3. Add to SST secrets:

```bash
sst secret set HoneycombAPIKey your-api-key-here
```

4. Update `otel-collector-config.yaml`:

```yaml
exporters:
  otlp/honeycomb:
    endpoint: api.honeycomb.io:443
    headers:
      x-honeycomb-team: ${env:HONEYCOMB_API_KEY}
      x-honeycomb-dataset: gbfm

service:
  pipelines:
    traces:
      exporters:
        - otlp/honeycomb
    metrics:
      exporters:
        - otlp/honeycomb
```

### Option 3: Grafana Cloud (SaaS)

**Pros**: All-in-one (metrics, logs, traces), good free tier, powerful dashboards
**Cons**: Complex to set up initially

1. Sign up at https://grafana.com/products/cloud/
2. Get your OTLP endpoint and API token
3. Add to SST secrets:

```bash
sst secret set GrafanaOTLPEndpoint https://otlp-gateway-xxx.grafana.net/otlp
sst secret set GrafanaAPIToken your-token
```

4. Update `otel-collector-config.yaml`:

```yaml
exporters:
  otlphttp/grafana:
    endpoint: ${env:GRAFANA_OTLP_ENDPOINT}
    headers:
      authorization: Basic ${env:GRAFANA_API_TOKEN}

service:
  pipelines:
    traces:
      exporters:
        - otlphttp/grafana
    metrics:
      exporters:
        - otlphttp/grafana
```

### Option 4: New Relic (SaaS)

**Pros**: Enterprise features, APM integration, good alerting
**Cons**: Expensive for high volume

1. Sign up at https://newrelic.com
2. Get your license key
3. Add to SST secrets:

```bash
sst secret set NewRelicLicenseKey your-license-key
```

4. Update `otel-collector-config.yaml`:

```yaml
exporters:
  otlp/newrelic:
    endpoint: otlp.nr-data.net:4317
    headers:
      api-key: ${env:NEW_RELIC_LICENSE_KEY}

service:
  pipelines:
    traces:
      exporters:
        - otlp/newrelic
    metrics:
      exporters:
        - otlp/newrelic
```

### Option 5: Datadog (SaaS)

**Pros**: Comprehensive platform, great infrastructure monitoring
**Cons**: Most expensive option

1. Sign up at https://datadoghq.com
2. Get your API key
3. Add to SST secrets:

```bash
sst secret set DatadogAPIKey your-api-key
```

4. Update `otel-collector-config.yaml`:

```yaml
exporters:
  datadog:
    api:
      key: ${env:DATADOG_API_KEY}
      site: datadoghq.com

service:
  pipelines:
    traces:
      exporters:
        - datadog
    metrics:
      exporters:
        - datadog
```

### Option 6: Multiple Backends

You can send to multiple backends simultaneously:

```yaml
service:
  pipelines:
    traces:
      exporters:
        - otlp/jaeger        # For development/debugging
        - otlp/honeycomb     # For production analysis
        - logging            # For troubleshooting
```

## Usage Examples

### Basic HTTP Request (Automatic)

HTTP requests are automatically instrumented:

```typescript
// No code needed! Every request gets:
// - Span created automatically
// - HTTP attributes (method, status, duration)
// - Metrics recorded
// - Errors captured
```

### Custom Span in Route Handler

```typescript
import { withSpan } from '@/middlewares/telemetry'

app.get('/mixes/:id', async (c) => {
  const mixId = c.req.param('id')

  const mix = await withSpan(
    'db.getMix',
    { 'mix.id': mixId },
    async () => {
      return await db.query.mixes.findFirst({
        where: eq(mixes.id, mixId)
      })
    }
  )

  return c.json(mix)
})
```

### Add Attributes to Current Span

```typescript
import { setSpanAttributes } from '@/middlewares/telemetry'

app.get('/user/profile', async (c) => {
  const user = c.get('user')

  // Add user context to the current request span
  setSpanAttributes({
    'user.id': user.id,
    'user.tier': user.tier,
    'user.email': user.email
  })

  // ... rest of handler
})
```

### Add Events

```typescript
import { addSpanEvent } from '@/middlewares/telemetry'

async function uploadMix(file: File) {
  addSpanEvent('upload.started', { 'file.size': file.size })

  await uploadToS3(file)

  addSpanEvent('upload.completed', { 'file.size': file.size })
}
```

### Effect Integration

```typescript
import { withSpan } from '@/lib/telemetry/effect'
import { Effect } from 'effect'

const processPendingReminders = withSpan('processPendingReminders', {
  'cron.job': 'music-reminders'
})(
  Effect.gen(function* () {
    const reminders = yield* fetchPendingReminders
    yield* Effect.forEach(reminders, sendReminderEmail)
  })
)

// Run it
await Effect.runPromise(processPendingReminders)
```

### Cron Job Instrumentation

```typescript
import { instrumentCron } from '@/lib/telemetry/effect'
import cron from 'node-cron'

cron.schedule('* * * * *', async () => {
  try {
    await instrumentCron('music-reminders', processPendingReminders)
    console.log('✅ Reminders processed successfully')
  } catch (error) {
    console.error('❌ Failed to process reminders:', error)
  }
})
```

### Custom Metrics

```typescript
import { mixMetrics } from '@/lib/telemetry'

// Record a mix upload
mixMetrics.uploadCount.add(1, {
  'user.tier': user.tier,
  'mix.format': 'mp3'
})

mixMetrics.fileSize.record(file.size, {
  'mix.format': 'mp3'
})

// Record processing time
const startTime = Date.now()
await processMix(file)
const duration = Date.now() - startTime
mixMetrics.processingDuration.record(duration, {
  'mix.format': 'mp3'
})
```

## Environment Variables

Configure the application via environment variables:

```bash
# OTEL Collector endpoint (auto-detected in ECS)
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.local:4318

# Service name
OTEL_SERVICE_NAME=gbfm-vps

# App version (for tracking deployments)
APP_VERSION=1.2.3

# Deployment environment
DEPLOYMENT_ENVIRONMENT=production

# Disable telemetry entirely (for testing)
OTEL_SDK_DISABLED=false
```

## Cost Optimization

### 1. Tail Sampling

The collector is configured with tail sampling:
- Always keeps error traces (100%)
- Always keeps slow requests >1s (100%)
- Samples 10% of successful requests

This reduces data volume by ~90% while keeping important traces.

### 2. Filter Health Checks

Health check endpoints are filtered out:

```yaml
processors:
  filter/healthcheck:
    traces:
      span:
        - 'attributes["http.route"] == "/health"'
```

### 3. Batch Processing

Traces are batched before export to reduce network overhead:

```yaml
processors:
  batch:
    timeout: 10s
    send_batch_size: 1024
```

### 4. Attribute Limits

Keep attribute cardinality low:

```typescript
// ❌ Bad: High cardinality
span.setAttribute('user.id', userId) // Millions of values

// ✅ Good: Low cardinality
span.setAttribute('user.tier', userTier) // Only 3-4 values
```

## Debugging

### View Collector Logs

```bash
# Get task ID
aws ecs list-tasks --cluster gbfm_cluster --service OTELCollector

# View logs
aws logs tail /ecs/otel-collector --follow
```

### Check Collector Health

```bash
curl http://otel-collector.local:13133/
```

### View Collector Metrics

```bash
curl http://otel-collector.local:8888/metrics
```

### Debug Pages (zpages)

Access at `http://otel-collector.local:55679/debug/tracez`

## Troubleshooting

### No traces appearing?

1. Check if telemetry is initialized:
   ```typescript
   console.log('OTEL_EXPORTER_OTLP_ENDPOINT:', process.env.OTEL_EXPORTER_OTLP_ENDPOINT)
   ```

2. Check collector logs for errors

3. Verify network connectivity:
   ```bash
   # From VPS container
   curl http://otel-collector.local:4318/v1/traces
   ```

### High costs?

1. Increase sampling rate (from 10% to 5% or lower)
2. Add more filters for noisy endpoints
3. Use tail sampling more aggressively
4. Choose a cheaper backend (Jaeger is free!)

### Spans not nested correctly?

Make sure you're using `context.with()` or the helper functions:

```typescript
// ❌ Bad: Spans won't be nested
const span1 = tracer.startSpan('outer')
const span2 = tracer.startSpan('inner')

// ✅ Good: Proper nesting
const span1 = tracer.startSpan('outer')
const ctx = trace.setSpan(context.active(), span1)
context.with(ctx, () => {
  const span2 = tracer.startSpan('inner')
})
```

## Migration Path

You can adopt OpenTelemetry incrementally:

1. **Phase 1**: Deploy collector, basic HTTP instrumentation
2. **Phase 2**: Add custom spans to critical paths
3. **Phase 3**: Add business metrics
4. **Phase 4**: Full Effect integration
5. **Phase 5**: Set up alerting and dashboards

## Best Practices

1. **Don't over-instrument**: Auto-instrumentation covers 80% of cases
2. **Keep attributes low-cardinality**: Avoid user IDs, use tiers/types instead
3. **Use semantic conventions**: Follow [OpenTelemetry conventions](https://opentelemetry.io/docs/specs/semconv/)
4. **Test locally first**: Use Jaeger locally before production
5. **Monitor your monitoring**: Watch collector CPU/memory usage

## Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [OTEL Collector Configuration](https://opentelemetry.io/docs/collector/configuration/)
- [Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [Instrumentation Libraries](https://opentelemetry.io/docs/instrumentation/)
