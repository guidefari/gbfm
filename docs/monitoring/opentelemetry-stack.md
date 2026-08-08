# OpenTelemetry (OTel) Stack Documentation

This document provides comprehensive documentation for the OpenTelemetry observability stack implemented in the Goosebumps FM project.

## Overview

The project implements a full observability stack using OpenTelemetry for distributed tracing, with additional components for metrics collection, log aggregation, and visualization. The stack follows the Grafana ecosystem approach and is containerized using Docker Compose.

## Architecture

### Core Components

#### 1. OpenTelemetry Tracing (Tempo)

- **Purpose**: Distributed tracing backend
- **Technology**: Grafana Tempo
- **Port**: 3200 (HTTP), 4317 (gRPC OTLP), 4318 (HTTP OTLP)
- **Configuration**: `config/tempo.yaml`
- **Storage**: Local filesystem (`/tmp/tempo/blocks` and `/tmp/tempo/wal`)

#### 2. Metrics Collection (Prometheus)

- **Purpose**: Time-series metrics collection and storage
- **Technology**: Prometheus
- **Port**: 9090
- **Configuration**: `config/prometheus.yml`
- **Retention**: 90 days
- **Storage**: `/prometheus` (Docker volume)

#### 3. Log Aggregation (Loki + Promtail)

- **Purpose**: Centralized logging
- **Technology**: Grafana Loki (backend) + Promtail (collector)
- **Ports**: 3100 (Loki), 9080 (Promtail)
- **Configuration**:
  - Loki: `config/loki-config.yml`
  - Promtail: `config/promtail-config.yml`
- **Log Sources**:
  - PostgreSQL logs (`/var/log/postgresql/*.log`)
  - System logs (`/var/log/host/syslog`)

#### 4. Visualization (Grafana)

- **Purpose**: Dashboard and visualization platform
- **Technology**: Grafana
- **Port**: 3000
- **Default Credentials**: admin/admin123
- **Configuration**: `config/grafana/`
- **Data Sources**: Tempo (traces), Prometheus (metrics), Loki (logs)

#### 5. System Metrics (Node Exporter)

- **Purpose**: Host system metrics
- **Technology**: Prometheus Node Exporter
- **Port**: 9100
- **Metrics**: CPU, memory, disk, network usage

#### 6. Database Metrics (PostgreSQL Exporter)

- **Purpose**: PostgreSQL database metrics
- **Technology**: Prometheus PostgreSQL Exporter
- **Port**: 9187
- **Configuration**: `config/postgres_exporter_queries.yaml`
- **Custom Queries**: Table statistics, query performance metrics

## Application Integration

### OpenTelemetry SDK Setup

The application uses OpenTelemetry for distributed tracing with the following implementation:

#### Files:

- `apps/vps/src/lib/otel.ts` - Core OTEL initialization
- `apps/vps/src/index.ts` - Entry point integration

#### Configuration:

```typescript
// Environment variables
NODE_ENV=production                    // Controls environment metadata
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318  // Configured destination (Jaeger locally)
OTEL_SERVICE_NAME=goosebumps-fm-api    // Set by the VPS preload when absent
```

#### Features:

- **Batched OTLP export**: the configured OTLP destination uses `BatchSpanProcessor`
- **Local dual export**: `dev` and `local` also mirror traces to the shared Tempo endpoint at `http://127.0.0.1:14318`, while the configured endpoint can remain Jaeger at `http://127.0.0.1:4318`
- **Resource Attributes**: all providers receive the `goosebumps-fm-api` service name, version, namespace, and environment
- **OTLP Protocol Support**: the application exports OTLP/HTTP protobuf traces

### Tracing Coverage

#### Services with Full Span Coverage:

- `favorite.service.ts` - Complete `Effect.withSpan` implementation
- `music-reminder.service.ts` - Complete `Effect.withSpan` implementation
- `spotify.service.ts` - Full span coverage for all operations:
  - `spotify.getTrack` - Attributes: `spotify.id`, `external.system`
  - `spotify.getAlbum` - Attributes: `spotify.id`, `external.system`
  - `spotify.getPlaylist` - Attributes: `spotify.id`, `external.system`
  - `spotify.searchAlbums` - Attributes: `spotify.query_length`, `spotify.limit`, `spotify.offset`
  - `spotify.enrichTrackFromUrl` - Attributes: `music.platform`, `url.type`, `spotify.id`
  - `bandcamp.getMetadata` - Attributes: `cache.hit`, `http.status_code`, `external.system`
- `s3.service.ts` - Full span coverage:
  - `aws.s3.putObject` - Attributes: `aws.service`, `s3.bucket`, `s3.key_prefix`, `content.type`, `payload.size_bytes`
  - `aws.s3.deleteObject` - Attributes: `aws.service`, `s3.bucket`, `s3.key_prefix`
- `email.service.ts` - Full span coverage:
  - `email.send` - Attributes: `email.type`, `email.template`, `reminder.id`, `user.id`, `external.system`
- `label.service.ts` - Full span coverage:
  - `label.getAll` - Attributes: `pagination.limit`, `pagination.offset`
  - `label.getBySlug` - Attributes: `label.slug`
  - `label.create` - Attributes: `label.slug`, `creatorIds.count`
  - `label.update` - Attributes: `label.slug`, `fields.updated`

#### Services with Span Annotations:

- `audio.service.ts` - Partial annotations in create operations
- `post.service.ts` - Annotations in tag and create operations

#### Remaining Services (To Be Implemented):

- `release.service.ts`
- `publication.service.ts`
- `user.service.ts`
- `show.service.ts`
- `profile.service.ts`

## Docker Compose Configuration

The observability stack is defined in `docker-compose.yml` with the following services:

### Networking

- All services connected via `postgres_network` bridge network
- Isolated from application traffic for security

### Volumes

- `prometheus_data` - Metrics storage
- `grafana_data` - Dashboard configurations
- `loki_data` - Log storage
- `tempo_data` - Trace storage

### Health Checks

- PostgreSQL includes health check for monitoring database availability

## Configuration Files

### Tempo Configuration (`config/tempo.yaml`)

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/blocks
    wal:
      path: /tmp/tempo/wal
```

### Prometheus Configuration (`config/prometheus.yml`)

- Scrapes metrics from PostgreSQL Exporter and Node Exporter
- 15s scrape interval, 15s evaluation interval
- 90-day retention period

### Loki Configuration (`config/loki-config.yml`)

- Filesystem storage backend
- 24h index period
- 168h (1 week) log retention

### Promtail Configuration (`config/promtail-config.yml`)

- Collects PostgreSQL logs and system logs
- Forwards to Loki on port 3100

## Deployment and Usage

### Starting the Stack

#### Option 1: Full Stack

```bash
docker compose up tempo grafana prometheus loki promtail postgres_exporter node_exporter -d
```

#### Option 2: Via SST Dev Console

Run `Otel_Stack` from the SST development console.

### Accessing Services

| Service | URL                           | Purpose             |
| ------- | ----------------------------- | ------------------- |
| Grafana | https://grafana.localhost     | Tempo trace UI      |
| Jaeger  | https://jaeger.localhost      | Jaeger trace UI     |
| Tempo   | https://tempo.localhost/api/* | Raw trace API       |
| Loki    | http://localhost:3100         | Log query interface |

### Application Configuration

#### Development (Visual Tracing)

```bash
cd ~/.config/caddy
just obs-up

# Jaeger is the configured destination; local development also mirrors to Tempo.
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
bun dev
```

Browse the same local request in Jaeger at `https://jaeger.localhost` and in Tempo through Grafana at `https://grafana.localhost`. Local traces should appear under the `goosebumps-fm-api` service.

#### Production

```bash
export NODE_ENV=production
export OTEL_EXPORTER_OTLP_ENDPOINT=https://your-collector-endpoint:4318
export OTEL_SAMPLING_RATE=0.1
bun start
```

## Monitoring and Alerting

### Metrics Available

#### PostgreSQL Metrics (via postgres_exporter)

- Table statistics (scans, inserts, updates, deletes)
- Query performance (execution time, buffer hit ratios)
- Vacuum and analyze counts
- Live/dead tuple counts

#### System Metrics (via node_exporter)

- CPU usage and load
- Memory utilization
- Disk I/O and space
- Network traffic

#### Application Metrics (via Prometheus)

- Request latency and throughput
- Error rates
- Custom business metrics

### Log Aggregation

#### Sources

- PostgreSQL query logs
- Application error logs
- System logs

#### Queries

Logs are queryable through Grafana's Explore interface using Loki query language.

## Troubleshooting

### Common Issues

#### Traces Not Appearing

1. Verify `OTEL_EXPORTER_OTLP_ENDPOINT` is set correctly
2. Check Tempo container logs for connection errors
3. Ensure application has network access to Tempo (port 4318)

#### Metrics Not Collecting

1. Check Prometheus targets at http://localhost:9090/targets
2. Verify exporter containers are running
3. Check network connectivity between containers

#### Grafana Connection Issues

1. Ensure all services are on the same Docker network
2. Check Grafana datasource configurations
3. Verify service ports are not conflicting

### Debugging Commands

```bash
# Check container status
docker compose ps

# View container logs
docker compose logs tempo
docker compose logs prometheus
docker compose logs grafana

# Test OTLP endpoint
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[]}'
```

## Future Enhancements

### High Priority

1. Complete span coverage across all services
2. Add HTTP auto-instrumentation for request tracing
3. Implement structured logging with trace correlation

### Medium Priority

1. Add custom metrics collection
2. Implement trace context propagation for distributed requests
3. Add alerting rules in Prometheus

### Low Priority

1. Migrate from local Tempo storage to distributed backend
2. Add log parsing and structured field extraction
3. Implement custom Grafana dashboards

## Security Considerations

- OTLP endpoints should use HTTPS in production
- Grafana admin password should be changed from default
- Network isolation between observability stack and application
- Consider authentication for OTLP ingestion
- Regular updates of container images for security patches

## Performance Impact

- Tracing overhead: ~1-5% CPU, minimal memory impact
- Sampling reduces production overhead to acceptable levels
- Metrics collection: Negligible performance impact
- Log shipping: Minimal network overhead

## Cost Considerations

- Storage costs for metrics, logs, and traces
- Network egress costs for OTLP export to cloud providers
- Container resource allocation in production deployments
- Grafana Cloud or self-hosted decision based on scale</content>
  <parameter name="filePath">/Users/guidefari/source/oss/gbfm/docs/opentelemetry-stack.md
