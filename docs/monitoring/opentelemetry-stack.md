# Local tracing

For how production telemetry works, read `docs/observability.md`. This file is
only about seeing traces on your own machine.

## Running it

```bash
bun run otel
```

That starts Jaeger through docker compose. The UI is at
`http://localhost:16686`, and it accepts OTLP on `4317` (gRPC) and `4318`
(HTTP).

`OtlpLive` in `apps/server/src/lib/otel.ts` adds `http://127.0.0.1:4318` as an
export target whenever the stage is `dev` or `local`, so a locally running
Worker sends traces there without any further configuration. Setting
`OTEL_EXPORTER_OTLP_ENDPOINT` adds a second target rather than replacing the
local one.

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
