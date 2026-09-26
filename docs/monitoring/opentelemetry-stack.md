# Local tracing

For how production telemetry works, read `docs/observability.md`. This file is
only about seeing traces on your own machine.

## Running it

```bash
bun run otel
```

Run `bun dev` in another terminal and visit `https://gbfm.localhost`. The local
SvelteKit app exports `goosebumps-fm-www` spans for request handling, server
loads, and calls through its API gateway. In Jaeger, select that service and
open a trace. The `gbfm.request_id` attribute matches the `x-request-id`
response header and the structured `www` request and API-call logs.

The API Worker records the same validated request ID on its request span and
structured request logs. For local requests its HTTP handler and Effect services
use `OtlpTracer`, continuing the `traceparent` from `www`. Open a
`goosebumps-fm-www` trace to see the page route, API paths, and nested service
spans in one waterfall. Production Worker tracing remains on Sentry. Application
logs are printed locally but are not exported to Loki by this setup.

That starts Jaeger through docker compose. The UI is at
`http://localhost:16686`, and it accepts OTLP on `4317` (gRPC) and `4318`
(HTTP).

`OtlpLive` in `apps/server/src/lib/otel.ts` adds `http://127.0.0.1:4318` for
the Bun runtime in the `dev` or `local` stage. The current local API runs as a
Cloudflare Worker instead, using `WorkerTracingLive` and Sentry's tracer. The
Bun export setting does not apply to that Worker.

## What used to be here

This project once ran a full Grafana stack locally: Tempo for traces,
Prometheus for metrics, Loki and Promtail for logs, Grafana to view them, and a
`postgres_exporter`. That was cut down to Jaeger alone in `726ca1249`, and the
Postgres pieces stopped meaning anything once the Bun and Postgres runtime was
retired.

The `config/` directory that held `tempo.yaml`, `prometheus.yml`,
`loki-config.yml`, `promtail-config.yml` and `grafana/` is gone with them. If
you want that stack back, take the configs from git history rather than writing
them again, and note that the Prometheus config scraped a `postgres_exporter`
target that no longer has anything to export.
