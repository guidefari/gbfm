# OpenTelemetry Implementation Checklist

Follow this checklist to implement vendor-neutral OpenTelemetry observability.

## Prerequisites

- [ ] AWS account with ECS access
- [ ] SST v3 installed
- [ ] Bun installed
- [ ] Choose your telemetry backend (Jaeger/Honeycomb/Grafana/etc.)

## Phase 1: Infrastructure Setup (30 minutes)

### Step 1: Review Configuration Files

All configuration files have been created. Review them:

- [ ] `otel-collector-config.yaml` - Collector configuration
- [ ] `prometheus.yml` - Prometheus scrape config (optional)
- [ ] `infra/observability.ts` - ECS services for collector
- [ ] `OPENTELEMETRY.md` - Full documentation
- [ ] `OPENTELEMETRY_EXAMPLES.ts` - Code examples

### Step 2: Configure Your Backend

Choose ONE backend to start with (you can add more later):

#### Option A: Jaeger (Free, Self-Hosted) ✅ Recommended for Testing

```bash
# No secrets needed, it's included in the infrastructure
# Just uncomment in otel-collector-config.yaml:

# In the exporters section, ensure:
exporters:
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true

# In the service.pipelines.traces.exporters section:
service:
  pipelines:
    traces:
      exporters:
        - logging
        - otlp/jaeger  # Uncomment this
```

#### Option B: Honeycomb (SaaS, Free Tier)

```bash
# 1. Sign up at https://honeycomb.io
# 2. Get your API key
# 3. Add to SST secrets:
sst secret set HoneycombAPIKey your-api-key-here

# 4. Uncomment in otel-collector-config.yaml:
service:
  pipelines:
    traces:
      exporters:
        - logging
        - otlp/honeycomb  # Uncomment this
```

#### Option C: Grafana Cloud (SaaS, Free Tier)

```bash
# 1. Sign up at https://grafana.com
# 2. Get OTLP endpoint and token
# 3. Add to SST secrets:
sst secret set GrafanaOTLPEndpoint https://otlp-gateway-xxx.grafana.net/otlp
sst secret set GrafanaAPIToken $(echo -n "instance_id:your_token" | base64)

# 4. Uncomment in otel-collector-config.yaml:
service:
  pipelines:
    traces:
      exporters:
        - logging
        - otlphttp/grafana  # Uncomment this
```

### Step 3: Deploy Infrastructure

```bash
# Deploy all infrastructure (including OTEL Collector)
bun deploy

# Or for production:
bun deploy:prod
```

Verify deployment:
```bash
# Check ECS services
aws ecs list-services --cluster gbfm_cluster

# Should see:
# - gbfm_vps
# - OTELCollector
# - Jaeger (if using Jaeger)
```

## Phase 2: Application Instrumentation (45 minutes)

### Step 1: Install Dependencies

```bash
cd apps/vps

bun add @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-metrics-otlp-http \
  @opentelemetry/sdk-metrics \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/sdk-trace-base
```

### Step 2: Verify Telemetry Files

All telemetry files have been created. Verify they exist:

```bash
# Check telemetry module
ls -la apps/vps/src/lib/telemetry/
# Should show:
# - init.ts
# - metrics.ts
# - effect.ts
# - index.ts

# Check middleware
ls -la apps/vps/src/middlewares/telemetry.ts
```

### Step 3: Update Application Entry Point

Edit `apps/vps/src/index.ts`:

```typescript
import { initializeTelemetry } from './lib/telemetry'

// Initialize BEFORE importing anything else
initializeTelemetry()

// Now import your app
import app from './app'
import { env } from './env'

export default {
  port: env.PORT,
  fetch: app.fetch
}
```

### Step 4: Update Create App

Edit `apps/vps/src/lib/create-app.ts`:

```typescript
import { telemetryMiddleware } from '@/middlewares/telemetry'

export default function createApp() {
  const app = createRouter()

  app.use('*', cors(corsConfig))

  app
    .use(requestId())
    .use(telemetryMiddleware())  // Add this line
    .use(pinoLogger())
    .use(serveEmojiFavicon('🪿'))

  app.notFound(notFound)
  app.onError(onError)
  return app
}
```

### Step 5: Update Environment Variables

Add to your environment (via SST secrets or environment):

```bash
# Service name
export OTEL_SERVICE_NAME=gbfm-vps

# App version (update with each deploy)
export APP_VERSION=1.0.0

# Deployment environment
export DEPLOYMENT_ENVIRONMENT=production

# OTLP endpoint (auto-detected in ECS, but set for local dev)
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### Step 6: Update VPS Infrastructure

Edit `infra/vps.ts` to add environment variables:

```typescript
export const service = new sst.aws.Service('gbfm_vps', {
  cluster,
  // ... existing config ...
  environment: {
    OTEL_SERVICE_NAME: 'gbfm-vps',
    APP_VERSION: '1.0.0',
    DEPLOYMENT_ENVIRONMENT: $app.stage,
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-collector.local:4318'
  },
  // ... rest of config
})
```

## Phase 3: Testing (30 minutes)

### Step 1: Local Testing

```bash
# Terminal 1: Run OTEL Collector locally
docker run -p 4317:4317 -p 4318:4318 \
  -v $(pwd)/otel-collector-config.yaml:/etc/otel-collector-config.yaml \
  otel/opentelemetry-collector-contrib:0.96.0 \
  --config=/etc/otel-collector-config.yaml

# Terminal 2: Run Jaeger locally (if using Jaeger)
docker run -d -p 16686:16686 -p 4317:4317 jaegertracing/all-in-one:1.54

# Terminal 3: Run your app
cd apps/vps
bun dev
```

### Step 2: Generate Test Traffic

```bash
# Make some requests
curl http://localhost:3003/health
curl http://localhost:3003/api/mixes

# Generate errors to test error tracking
curl http://localhost:3003/api/nonexistent
```

### Step 3: Verify Traces

If using Jaeger:
```bash
# Open Jaeger UI
open http://localhost:16686

# You should see:
# - Service: gbfm-vps
# - Operations: HTTP GET /health, HTTP GET /api/mixes, etc.
# - Traces with all spans
```

If using Honeycomb/Grafana:
```bash
# Check their web UIs
# - Honeycomb: https://ui.honeycomb.io
# - Grafana: https://your-instance.grafana.net
```

### Step 4: Deploy to AWS

```bash
# Deploy everything
bun deploy

# Check logs
aws logs tail /ecs/gbfm-vps --follow
aws logs tail /ecs/otel-collector --follow
```

### Step 5: Verify Production

```bash
# Make requests to production
curl https://vps.goosebumps.fm/health

# Check your telemetry backend for traces
```

## Phase 4: Advanced Instrumentation (Optional)

### Step 1: Add Custom Spans to Routes

See `OPENTELEMETRY_EXAMPLES.ts` for examples. Pick a few critical routes:

```typescript
// Example: apps/vps/src/api/mixes/routes.ts
import { withSpan, setSpanAttributes } from '@/middlewares/telemetry'

app.get('/mixes/:id', async (c) => {
  const mixId = c.req.param('id')

  setSpanAttributes({ 'mix.id': mixId })

  const mix = await withSpan('db.getMix', { 'mix.id': mixId }, async () => {
    return await db.query.mixes.findFirst({ where: eq(mixes.id, mixId) })
  })

  return c.json(mix)
})
```

### Step 2: Instrument Cron Jobs

Update `apps/vps/src/app.ts`:

```typescript
import { instrumentCron } from '@/lib/telemetry/effect'

cron.schedule('* * * * *', async () => {
  await instrumentCron('music-reminders', processPendingReminders)
})
```

### Step 3: Add Business Metrics

```typescript
import { mixMetrics, emailMetrics } from '@/lib/telemetry'

// Record a mix upload
mixMetrics.uploadCount.add(1, { 'format': 'mp3' })
mixMetrics.fileSize.record(file.size, { 'format': 'mp3' })

// Record email sent
emailMetrics.sentCount.add(1, { 'type': 'reminder' })
```

## Phase 5: Monitoring & Alerts (Optional)

### Set Up Dashboards

Depending on your backend:

**Jaeger**: Built-in UI, no setup needed

**Honeycomb**: Create boards for:
- Request rate by endpoint
- Error rate
- P95 latency
- Slow traces

**Grafana**: Import pre-built dashboards:
- OpenTelemetry APM Dashboard
- RED Metrics Dashboard
- Custom business metrics

### Set Up Alerts

Example alerts to set up:

1. **High Error Rate**
   - Condition: Error rate > 5% for 5 minutes
   - Action: Send to Slack/email

2. **Slow Requests**
   - Condition: P95 latency > 2s for 5 minutes
   - Action: Send to Slack/email

3. **Cron Job Failures**
   - Condition: Cron job failed
   - Action: Page on-call engineer

4. **High Memory Usage**
   - Condition: Memory > 80% for 10 minutes
   - Action: Send to Slack

## Common Issues

### Issue: No traces appearing

**Solution:**
```bash
# 1. Check if telemetry is initialized
grep "Initializing OpenTelemetry" logs

# 2. Check collector logs
aws logs tail /ecs/otel-collector --follow

# 3. Verify network connectivity
aws ecs execute-command --cluster gbfm_cluster \
  --task <task-id> --interactive \
  --command "curl http://otel-collector.local:4318/v1/traces"
```

### Issue: Collector crashes

**Solution:**
```bash
# Check memory limits
# Edit infra/observability.ts and increase memory:
memory: '2 GB'  # Was '1 GB'

# Redeploy
bun deploy
```

### Issue: Too many traces / high costs

**Solution:**
```yaml
# Edit otel-collector-config.yaml
# Reduce sampling rate:
processors:
  tail_sampling:
    policies:
      - name: probabilistic-policy
        type: probabilistic
        probabilistic:
          sampling_percentage: 5  # Was 10
```

## Success Criteria

You've successfully implemented OpenTelemetry when you can:

- [ ] See traces in your backend UI
- [ ] See HTTP requests automatically traced
- [ ] See database queries traced
- [ ] See custom spans for business logic
- [ ] See metrics (request count, error rate, etc.)
- [ ] See errors automatically captured
- [ ] See cron jobs traced
- [ ] Can query traces by attributes (user ID, endpoint, etc.)
- [ ] Can see service dependencies in a service map
- [ ] Can drill down from a slow request to the specific query

## Next Steps

1. **Week 1**: Monitor traces, fix any issues
2. **Week 2**: Add custom spans to critical paths
3. **Week 3**: Set up dashboards and alerts
4. **Week 4**: Review and optimize (sampling, costs, etc.)

## Resources

- `OPENTELEMETRY.md` - Full documentation
- `OPENTELEMETRY_EXAMPLES.ts` - Code examples
- `otel-collector-config.yaml` - Collector config
- https://opentelemetry.io/docs/ - Official docs

## Support

If you run into issues:
1. Check logs: `aws logs tail /ecs/otel-collector --follow`
2. Check health: `curl http://otel-collector.local:13133/`
3. Review docs: `OPENTELEMETRY.md`
4. Check examples: `OPENTELEMETRY_EXAMPLES.ts`
