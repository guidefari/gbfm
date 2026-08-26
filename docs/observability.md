# Observability

Production API, CDN, and static-site Workers export traces and logs through Cloudflare's account-level `planetaryescape-traces` and `planetaryescape-logs` destinations. Those destinations send OTLP/HTTP to the Planetaryescape collector and are managed by the `hetzner-observability` repository.

The application repository never receives the collector bearer token. Alchemy only writes the destination names and sampling policy into each Worker. Browser and mobile bundles do not export directly because a shared ingest credential cannot be kept secret in client code.

Production exports 100 percent of traces and logs without retaining another copy in Cloudflare. Non-production Workers retain telemetry in Cloudflare and do not export to the production collector.

The API request handler creates a `gbfm.api.request` custom span with the HTTP method and URL path. Cloudflare automatically nests supported platform operations such as D1, R2, KV, Durable Object, and outbound fetch calls beneath the active request trace.

Open the provisioned `GBFM / Cloudflare Workers` dashboard at `https://grafana.planetaryescape.co.za` to inspect invocation rate, failures, p95 duration, trigger mix, top spans, traces, and logs.
