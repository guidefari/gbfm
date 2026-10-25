# Cloudflare observability runbook

Cloudflare is the primary production observability backend. Sentry remains a temporary, separate error-reporting path during migration; do not use its trace graph to infer Cloudflare service-binding propagation.

## Ownership and data flow

| Surface | Owner | Purpose |
| --- | --- | --- |
| Workers Logs, traces, runtime metrics, and Query Builder | Cloudflare dashboard | WWW/API request investigation and native binding spans |
| D1 metrics and query insights | Cloudflare dashboard | Database diagnosis |
| `gbfm_api_<stage>` | API Worker | Bounded request availability and latency points |
| `gbfm_www_<stage>` | WWW Worker | Sampled browser navigation, CWV, error, and player points |
| `/dashboard/frontend-errors` | GBFM admin | Curated 24-hour browser/product aggregates only |
| Grafana Alerting | `hetzner-observability` / Flux | Sustained API error, latency, and collector-health alerts |

The platform owner is the first responder. Application owners investigate the affected route/provider. Escalate to the Cloudflare account owner when native logs, traces, Analytics Engine, D1 metrics, or Email delivery are unavailable across otherwise healthy Workers.

Every deployment uses one immutable `APP_RELEASE` (the Git SHA in CI) across WWW, API, direct Workers, structured logs/spans, and Analytics Engine points. Grafana alerts aggregate across releases. WWW validates or creates `x-request-id`, forwards it through the API service binding, and both Workers return it. Search `gbfm.request_id` or `requestId` to correlate application records; Cloudflare native trace context owns the WWW → API → D1/service-binding waterfall.

## Privacy contract

Telemetry may contain bounded route templates, method, status, duration, service, release, browser family, a rotating random 24-hour browser session ID, and sanitized browser error fingerprints. It must not contain authenticated identity, email, IP, secrets, authorization/cookie headers, raw URLs or query strings, raw SQL/parameters, or raw browser stacks. Provider spans use provider/system and operation metadata rather than credentials or response bodies.

Browser ingestion enforces a versioned schema, exact production origin, native rate limit, streamed 16 KiB body limit, bounded names/routes, and server-side release stamping. The application sampling probability is written with each point; all Analytics Engine aggregates must weight both `_sample_interval` and that probability.

## Investigate an incident

1. Open **Workers & Pages → Observability** in Cloudflare and select the affected production Worker.
2. Start with runtime metrics: invocation/error rate, wall/CPU duration, and status distribution. Compare the incident window to the prior window.
3. In **Logs** or **Query Builder**, filter by `requestId`, route template, release, service, or status. Never broaden the schema by logging the raw request URL.
4. Open the matching native trace. Inspect WWW → API service-binding propagation and automatic fetch, D1, R2, KV, queue, Durable Object, and Email spans. Application Effect spans annotate material Spotify, Bandcamp, storage, scraping, and email work.
5. For database symptoms, open **D1 → production database → Metrics**. Check query count, rows read/written, latency, and errors. Use the native D1 spans to identify the application operation; do not add raw SQL to logs.
6. For browser/product symptoms, open `/dashboard/frontend-errors`. An unavailable card means that Analytics Engine query failed; an empty card means no weighted events matched the 24-hour window. Use Cloudflare operational views for server diagnosis rather than duplicating them in admin.
7. Confirm the release shown by WWW, API, and browser points is the deployed Git SHA. Grafana alerts cover a time window across releases; use logs and traces to compare releases within that window.

Workers logs and traces retain seven days on the Paid plan. Analytics Engine retains three months. Export destinations remain enabled in addition to Cloudflare persistence, but incident response must work from Cloudflare alone.

## Alerts

Grafana owns alert evaluation and notifications. Flux provisions its rules from
[`hetzner-observability`](https://github.com/planetaryescape/hetzner-observability/blob/main/docs/alerting.md).
GBFM emits telemetry and does not run an alert-evaluation Worker.

- **API errors:** more than 0.5% HTTP 5xx or failed Cloudflare outcomes across a
  15-minute window, at least 100 observed server spans, sustained for 10 minutes.
- **API latency:** histogram p95 above 1,000 ms with the same sample floor and
  pending period.
- **Collector health:** both collector scrape targets must be available.

These rules use exported HTTP server spans across releases, not the former
Analytics Engine eligibility filters. Missing or low-volume API data preserves
the prior alert state. Recovery has a five-minute hold. Grafana sends grouped
notifications through Cloudflare's HTTPS Email Sending API.

Browser LCP, INP, and CLS collection and admin aggregates remain available, but
automated browser Web Vitals alerts have no Grafana replacement yet. Independent
uptime monitoring is deferred to
[Uptime Kuma issue #20](https://github.com/planetaryescape/hetzner-observability/issues/20).

The former evaluator package, Worker declaration, and drill were removed. Its
`TelemetryEvaluatorState` KV namespace remains declared with a retain policy to
preserve historical incident data. The Analytics Engine query credential remains
in use by the API's browser telemetry aggregates.

## First seven days: volume and cost review

Production starts with log and trace head sampling at 1 (100%). For each of the first seven UTC days after rollout, record:

1. **Workers & Pages → account usage:** log events written, trace spans, and projected overage. Paid Workers include 20 million observability events per month; Workers Logs retain seven days. Tracing shares this event pricing starting October 1, 2026.
2. Analytics Engine writes for `gbfm_api_prod` and `gbfm_www_prod`, including the effective 10% browser application sample.
3. Per-Worker invocation volume and unusually chatty application log/span producers.
4. D1 rows read/written and storage under **D1 → Metrics → Row Metrics**.

The platform owner records the daily numbers in the rollout issue. On day 7, retain 100% only if projected volume is acceptable. Otherwise change `headSamplingRate` for logs and traces in `alchemy/observability.ts`, preserving enough traffic for request correlation and rare errors, then deploy normally. This is the rollback/cost control; do not disable persistence or remove observability bindings.

Browser sampling is independently controlled by the production rate in the WWW browser telemetry collector. Change it only from measured Analytics Engine volume, and keep the per-point application sample rate so weighted queries remain correct.

At day 30, recalculate availability, API p95, CWV distributions, and minimum-volume gates from production data. Record and review any objective changes before changing the Grafana rules in the infrastructure repository.

## Deployment verification

After an approved production deployment:

1. Send one request with a unique valid `x-request-id` to WWW that causes an API read.
2. Find the WWW and API completion records by that ID, then open the native trace and confirm the service-binding/API/D1 waterfall.
3. Confirm both records and the browser point use the deployed Git SHA.
4. Exercise a controlled server error. In Cloudflare, verify its stack resolves to authored TypeScript. Alchemy builds direct Workers with hidden/private source maps; no public JavaScript response may include a `sourceMappingURL`, and map files must not be publicly fetchable.
5. Confirm Grafana can query current API span metrics and that the provisioned rules evaluate without datasource errors.

Production smoke requests and source-map resolution are post-deployment checks. They cannot be claimed from a local build.

## References

- [Workers observability](https://developers.cloudflare.com/workers/observability/)
- [Workers Logs retention and pricing](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Workers tracing](https://developers.cloudflare.com/workers/observability/traces/)
- [Analytics Engine limits and retention](https://developers.cloudflare.com/analytics/analytics-engine/limits/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
