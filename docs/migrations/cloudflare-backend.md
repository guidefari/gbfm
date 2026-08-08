# Cloudflare backend and AWS sunset

## Status

Exploration and decision record. No production infrastructure has been migrated yet.

## Goals

1. Remove the AWS runtime, storage, email, IAM, and deployment dependencies.
2. Move the three canonical S3 buckets to Cloudflare R2 without changing public object URLs.
3. Preserve the public API, cookie authentication, uploads, reminders, RSS, sitemap, and share-page behavior owned by `apps/vps`.
4. Reach a Cloudflare-native backend where that is a sound fit, without combining every migration risk into one cutover.
5. Keep the repository usable from Amp orbs and live Amp runners.

## What exists today

`apps/vps` is not only an HTTP server. It owns:

- the Effect HttpApi and Better Auth routes served by Bun;
- PostgreSQL access through Drizzle and `pg`;
- S3 object operations, including multipart upload and cross-bucket copy;
- transactional email through SES;
- an in-process music-reminder loop;
- hourly in-memory sitemap regeneration;
- QR/PDF generation using bundled fonts and filesystem APIs.

AWS currently supplies:

| Current resource | Source | Cloudflare target |
| --- | --- | --- |
| ECS service, VPC, Cloud Map | `infra/vps.ts` | Cloudflare Container behind a Worker for the first cut; Workers for compatible routes later |
| API Gateway | `infra/vps.ts` | Worker custom domain/routes |
| `User_Content` S3 bucket | `infra/bucket.ts` | R2 bucket + `cdn.goosebumps.fm/user-content/*` routing |
| `Mixes` S3 bucket | `infra/bucket.ts` | R2 bucket + `cdn.goosebumps.fm/mixes/*` routing |
| Retired `DatabaseBackups` S3 bucket | `infra/bucket.ts` | Keep unlinked until its 30-day lifecycle empties it; do not migrate |
| Database backups | PlanetScale | Operated directly in PlanetScale; no application cron/task |
| SES | `infra/email.ts`, `packages/email/src/ses.ts` | Cloudflare Email Service REST/SMTP or Worker adapter, subject to a production beta evaluation |
| SST secrets and links | `infra/secret.ts`, `ConfigService` | Wrangler bindings, vars, and secrets |
| AWS OIDC deploy role | `.github/workflows/deploy.yml` | Scoped Cloudflare API token or Cloudflare Workers Builds |
| SST/Pulumi deployment | `sst.config.ts`, `infra/*` | Wrangler configuration and Cloudflare APIs/resources |

The configured PostgreSQL database is external to the SST stack. Removing AWS does not require replacing PostgreSQL, but a strictly Cloudflare-only end state does.

## Recommended migration shape

Do not rewrite the database, runtime, storage, email, jobs, and deployment system in one release. Use a strangler migration with independent rollback points.

```diagram
Phase 1-3 (AWS removed)                         Cloudflare-only end state

┌──────────────┐                                ┌──────────────┐
│ Browser/apps │                                │ Browser/apps │
└──────┬───────┘                                └──────┬───────┘
       ▼                                               ▼
┌──────────────┐     ┌─────────────────┐        ┌──────────────┐
│ Edge Worker  │────▶│ Bun Container(s)│        │ API Worker   │
└──────┬───────┘     └───────┬─────────┘        └──┬─────┬─────┘
       │                     │                     │     │
       ▼                     ▼                     ▼     ▼
┌──────────────┐     ┌─────────────────┐        ┌────┐ ┌──────────┐
│ R2 + CDN     │     │ External        │        │ D1 │ │ R2 + CDN │
│ Email/Cron   │     │ PostgreSQL      │        └────┘ └──────────┘
└──────────────┘     │ direct TLS      │
                     └─────────────────┘
```

### Why Container first, not a direct Workers port

The current Bun image is a plausible Cloudflare Container lift-and-shift. A direct Worker port is not mechanical because the application currently depends on:

- `@effect/platform-bun`, `@sentry/bun`, a long-lived `ManagedRuntime`, and process signal handling;
- Node PostgreSQL pooling and PostgreSQL-specific Drizzle schemas;
- filesystem-backed multipart parsing and bundled font reads;
- CPU/memory-heavy PDF generation;
- in-process forever loops and process-local sitemap state;
- request bodies configured up to 1 GB.

Workers have 128 MB of memory, a compressed bundle limit, and account-plan request-body limits (100 MB on Free/Pro, 200 MB on Business, and 500 MB by default on Enterprise). Large uploads should go directly from the client to R2 even if the remaining API later runs in Workers.

Cloudflare Containers are generally available and preserve Bun and the existing Dockerfile, but they are not currently an ECS-equivalent autoscaling service. Stateless pools use a fixed set of addressable instances and random routing regardless of health, saturation, or location; instances start on demand and may sleep. A production spike must measure cold starts, cookie behavior, streaming uploads, health checks, deployment readiness, failure routing, and fixed-pool capacity before this path is accepted.

### Database decision

Use two explicit milestones:

1. **AWS-free milestone:** keep PostgreSQL and connect the Bun Container directly to the database over TLS. This minimizes application and schema changes and still permits all AWS resources to be retired. Hyperdrive is a Worker/Pages binding, not a PostgreSQL proxy endpoint available to the Container or `pg_dump` process.
2. **Cloudflare-only milestone:** migrate to D1 only after a compatibility and workload audit passes.

D1 is SQLite, not PostgreSQL. The current schema uses PostgreSQL arrays, enums, JSONB, UUID defaults, timezone-aware timestamps, GIN indexes, and PostgreSQL-specific query behavior. D1 also has a 10 GB limit per database. The audit must capture production database size, largest tables, write concurrency, transaction behavior, raw SQL, query plans, and every PostgreSQL-specific type/index before choosing D1. Durable Object SQLite is not a drop-in substitute for this shared relational model.

Hyperdrive remains useful for routes moved into Workers. Before using it, audit for unsupported PostgreSQL behavior such as advisory locks, `LISTEN`/`NOTIFY`, SQL-level prepared statement management, and per-session state.

## Phased plan and acceptance gates

### Phase 0: inventory and reversible spikes

- Record production database size and per-table row/byte counts.
- Record object count, byte count, storage class, largest object, metadata, incomplete multipart uploads, Glacier/Deep Archive objects, and objects larger than Super Slurper's limits for the two migrating S3 buckets.
- Record request volume, p95/p99 duration, maximum upload size, reminder volume, and email volume/bounce behavior.
- Build a non-production Cloudflare Container deployment and a minimal Worker-to-Container router.
- Prove that the external PostgreSQL endpoint is reachable securely from a Container. Separately build one Worker + Hyperdrive read-only endpoint as evidence for a later Workers port.
- Produce a PostgreSQL-to-D1 incompatibility report; do not translate schemas yet.

**Gate:** choose Container versus direct Worker per responsibility, and PostgreSQL/Hyperdrive versus D1, using measured constraints rather than platform preference.

### Phase 1: move S3 to R2

Implementation spec: [`s3-to-r2.md`](s3-to-r2.md), which supersedes this section. Tracked in Linear under [OPS-234](https://linear.app/guidefari/issue/OPS-234/s3-to-r2-migration-parent) (steps: [OPS-235](https://linear.app/guidefari/issue/OPS-235/inventory-user-content-and-mixes-buckets), [OPS-236](https://linear.app/guidefari/issue/OPS-236/consolidate-13-s3client-constructions-behind-objectstoreclient), [OPS-237](https://linear.app/guidefari/issue/OPS-237/delete-dead-cross-bucket-copy-path), [OPS-238](https://linear.app/guidefari/issue/OPS-238/cdn-router-worker-and-sst-wiring-for-r2), [OPS-239](https://linear.app/guidefari/issue/OPS-239/cut-mixes-bucket-over-to-r2), [OPS-240](https://linear.app/guidefari/issue/OPS-240/cut-user-content-bucket-over-to-r2), [OPS-241](https://linear.app/guidefari/issue/OPS-241/remove-database-backup-subsystem-gated-on-provider-verification), [OPS-242](https://linear.app/guidefari/issue/OPS-242/consolidate-legacy-cloudfront-assets-into-r2)).

Written against the traced code, it diverges from the plan below in four ways:

- browser CORS on R2 **is** required from day one (the browser PUTs multipart chunks directly to the bucket);
- cutover is forward-only per-bucket, not dual-write;
- infrastructure stays in **SST** via its Pulumi extensibility, with Alchemy deferred until all infra is on Cloudflare;
- only **two** buckets migrate. The database-backup subsystem was deleted after backup ownership moved directly to PlanetScale, and the dead cross-bucket copy path is deleted along with `S3Service.copyFile`.

Keep the remaining bucket boundaries for the first move. The existing application-facing `S3Service` contract is already the correct seam.

1. Create the two R2 buckets and the `qr-pdfs/` one-day lifecycle rule.
2. Centralize the current per-operation `new S3Client({})` construction behind the storage provider. Add the R2 endpoint, `region: "auto"`, and scoped credentials there; keep AWS and R2 selectable during migration.
3. Bulk-copy with Super Slurper. Enable Sippy during the convergence window only if its on-demand behavior is required; it does not refresh already-copied objects and can resurrect an object deleted only from R2 while the S3 source still contains it.
4. Compare object counts, sizes, metadata, and content hashes for critical samples. Do not use matching ETags as the integrity criterion; migration tools may change multipart boundaries and therefore ETags. Handle archived or migration-tool-incompatible objects separately.
5. Put a Worker on `cdn.goosebumps.fm` with bindings to both public buckets. It must select by `/user-content/` or `/mixes/`, strip that prefix, and preserve GET/HEAD, range and conditional requests, object metadata/cache headers, ETags, and current 404 behavior. Never bind the retired backup bucket to this public router.
6. Choose one explicit cutover invariant:
   - for true storage rollback, dual-write creates, replacements, and deletes to S3 and R2 for the whole rollback window and reconcile continuously; or
   - for a simpler forward-only storage cut, make R2 authoritative and allow compute rollback only if the old ECS service has also been configured to read and write R2.
7. Disable Sippy before accepting R2-authoritative deletes or lifecycle expiry, then close AWS writes after the rollback decision is final.

R2 implements the remaining S3 operations, but live contract tests remain required for multipart retry/resume behavior. R2 requires multipart parts of at least 5 MiB and equal-size non-final parts; the current 8 MiB chunks fit. Inventory must also prove objects copied with a single `CopyObject` fit R2's size limit.

The browser PUTs image bytes and each multipart chunk directly to the bucket via presigned URL (`apps/www/src/services/resumable-upload/service.ts`), which is why `infra/bucket.ts` already configures bucket CORS. R2 browser CORS is therefore required for the first storage cut on `User_Content`, configured with the exact browser origins and exposing `ETag`. Presigned writes must use the R2 S3 API hostname, not the public custom domain; public reads continue through `cdn.goosebumps.fm`.

**Gate:** uploads, resume/abort/complete/retry multipart operations, admin listing, imported cover art, QR expiry, and CDN range/conditional reads pass against R2; inventory reconciliation is clean.

### Phase 2: move jobs and email

- Replace SES behind the existing email package boundary. From Bun, use Email Service's REST API/authenticated SMTP or call a small Worker adapter; the native sending binding is available only once the caller runs in Workers. Evaluate the sending beta for the Workers Paid requirement, account quota, 5 MiB message size, 50-recipient limit, attachments, deliverability, and delivery/bounce/complaint events before adopting it. Keep an external transactional provider as the fallback if the beta fails the gate.
- Replace the reminder forever loop with a bounded scheduled/Queue-backed process. Process-local queues cannot be a correctness dependency in sleeping or horizontally routed compute. Define one-minute scheduling precision, idempotent claims, overlap prevention, retry policy, and backlog fan-out rather than assuming one invocation can process every due reminder.
- Replace hourly process-local sitemap regeneration with a Cron Trigger plus KV/R2 cache, or generate on demand with edge caching.
- While PostgreSQL remains, invoke the existing `pg_dump` image as a direct-database Container job and upload to R2. Use a Workflow or explicit status protocol to observe completion, retry failures, prevent overlap, alert, and verify restores; merely starting a Container from Cron is not backup success. Measure dump size against Container disk/memory because the current script buffers the full dump.
- If D1 is adopted, use Time Travel plus independent Workflow exports to R2. Paid Time Travel retains 30 days (Free retains seven); export can block other database requests, and in-place restore interrupts active work, so both export and restore need production-like load tests.

**Gate:** reminder lateness/duplicates/retries and a representative backlog, sitemap, email attachments and delivery events, backup failure/overlap, and restore drills succeed without the AWS service running.

### Phase 3: move compute and deployment

- Put a Worker on the target API hostname and proxy to a fixed Container pool.
- Move configuration from SST `Resource` lookups to a runtime-neutral config input populated by Wrangler bindings/secrets. Preserve local environment support.
- Deploy a staging revision, run black-box API tests, and validate Better Auth cookies and emailed links on the real hostname.
- Shift traffic gradually at the Cloudflare edge. Keep the ECS service available for rollback during soak.
- Replace `.github/workflows/deploy.yml` AWS OIDC/SST steps with validation plus Wrangler deploy, or use Workers Builds after equivalent controls are proven.
- Move the static site from `sst.cloudflare.StaticSiteV2` to Workers Static Assets or Pages so removing SST does not remove frontend deployment.
- Recreate or import every Cloudflare resource currently owned by SST/Pulumi—static site, `vps` and CDN DNS, and the RSS/sitemap/share redirect ruleset—under the replacement deployment owner before removing it from SST state.

**Gate:** error rate, latency, cold starts, container saturation, auth, 404/error mappings, RSS/sitemap/share pages, and large upload flows meet the baseline through a full soak window.

### Phase 4: optional D1 migration

- Translate Drizzle schemas from `pg-core` to SQLite only after the Phase 0 audit accepts D1.
- Decide whether one D1 database fits the 10 GB and write-throughput model. Do not invent sharding unless the domain has a natural boundary.
- Transform and import data, verify row counts and content checksums, then run all query paths against D1.
- Use backfill plus change capture or controlled dual-write; compare reads before switching.
- Replace PostgreSQL backup/restore tooling with D1 Time Travel and scheduled exports.

**Gate:** schema/query parity, write contention, auth/session behavior, migration rollback, and restore drills pass under representative load.

### Phase 5: AWS teardown

Teardown is a separate reviewed change after the rollback window:

- prove Cloudflare receives all API and CDN traffic;
- revoke application writes to AWS and verify no denied calls appear;
- take final database and bucket inventories;
- retain final backups independently;
- replace hard-coded legacy CloudFront image/audio URLs or prove their distributions are intentionally retained; these are additional AWS dependencies outside the canonical CDN router;
- remove ECS tasks/service, API Gateway, VPC, EventBridge/Lambda, SES identity, S3 buckets and CloudFront distributions, IAM/OIDC role, SST state, and AWS provider configuration;
- remove AWS SDK packages only when no runtime, migration, or restore path still uses them.

No destructive AWS operation belongs in the same deployment that switches production traffic.

## Amp orb and runner setup

The repository now contains the standard executable lifecycle hooks:

- `.agents/setup`: installs the locked workspace dependencies and idempotently ensures the Effect language-service patch in a fresh orb;
- `.agents/resume`: performs only a fast `node_modules` sanity check when an orb wakes.

Amp orbs clone a clean repository, so uncommitted local state is unavailable. Put required non-production credentials in the Amp project's secret/environment settings, never in these scripts or `AGENTS.md`.

Live runners use the checkout and environment of the machine where Amp is running. Start one from the repository root with:

```sh
amp --no-tui --runner-id gbfm-runner
```

or enable remote thread creation in an interactive Amp TUI. The runner must already have access to any local Docker daemon, Cloudflare credentials, or production-only network resources required by a task. Prefer orbs for isolated code changes and a controlled runner for work that genuinely depends on local credentials or uncommitted state.

The repository's full VPS test command uses Testcontainers and therefore needs a Docker-compatible daemon. `bun precommit` does not require Docker and remains the required validation command for ordinary changes.

## Existing docs and process to reuse

- `docs/migration-effect-http-api.md`: model for a phased migration plan with explicit risks and acceptance gates.
- `docs/migration-effect-http-api-process.md`: standing rules for one vertical slice per PR, adversarial review, and real test evidence.
- `docs/migrations/config-service-migration.md`: the existing non-SST configuration seam; update the source of truth instead of adding Cloudflare overrides throughout handlers.
- `docs/migrations/content-bucket-consolidation.md`: establishes the three production buckets as canonical and explicitly names R2 as the next step.
- `docs/architecture/cloudflare-redirects.md`: current public route behavior that compute migration must preserve.
- `docs/backup-feature-audit.md`: current backup and restore paths that storage/database migration must preserve.
- `.github/actions/setup-bun-workspace/action.yml`: canonical Bun workspace installation used by CI.
- Amp's [Orbs manual](https://ampcode.com/manual/orbs) and [runner documentation](https://ampcode.com/manual#runners): authoritative execution setup.

## Prompts for follow-up Amp threads

Use one thread per independently reviewable task. These prompts intentionally separate research, implementation, and teardown.

### Production inventory (runner, read-only)

> Read `docs/migrations/cloudflare-backend.md` first. Perform the Phase 0 production inventory from a live Amp runner with existing credentials. Do not modify infrastructure or data. Collect PostgreSQL size/table/write-concurrency evidence, S3 object/byte/storage-class/metadata inventories for all three canonical buckets, maximum observed upload size, and current AWS resource/cost inventory. Redact secrets. Save reproducible commands and results under `docs/migrations/evidence/`, then report which architecture gates the evidence changes.

### R2 implementation

> Implement only Phase 1 from `docs/migrations/cloudflare-backend.md`. Preserve the `S3Service` interface, all object keys, and `cdn.goosebumps.fm` public URLs. Add a selectable R2 configuration and targeted contract tests for every S3 operation currently used, including multipart resume/abort/complete/retry, cross-bucket copy, and the backup/restore scripts. Implement the two-bucket CDN path router without exposing backups. Do not change compute, database, email, or delete AWS resources. Run `bun precommit` and the narrowest storage tests available; document any test requiring live R2 credentials.

### Cloudflare Container spike

> Build a non-production Cloudflare Container spike for the existing `apps/vps` Docker image, fronted by a Worker. Do not route production traffic. Validate health/readiness, Better Auth cookies, request/response streaming, fixed-pool routing, cold start, sleep/wake, environment injection, outbound PostgreSQL and R2 access, and a representative upload. Return measurements and a go/no-go recommendation; remove throwaway code if the spike is no-go.

### D1 compatibility audit

> Audit `apps/vps` for PostgreSQL-to-D1 compatibility. Do not implement a migration. Enumerate every `pg-core` type/index/default, raw SQL query, transaction assumption, PostgreSQL operator, database size/write-rate constraint, and Better Auth adapter requirement. Produce a table of direct translations, application rewrites, and blockers with exact file paths. Recommend D1, PostgreSQL through Hyperdrive, or a bounded prototype, and state what production evidence remains missing.

### AWS teardown review

> Review readiness for Phase 5 in `docs/migrations/cloudflare-backend.md`. Stay read-only. Prove from Cloudflare and AWS metrics that no production reads, writes, email, jobs, deploys, DNS routes, or recovery procedures still depend on AWS. Produce an explicit retain/delete list and rollback-retention dates. Treat any unverified dependency as a blocker; do not delete anything.

## Primary Cloudflare references

- [Containers](https://developers.cloudflare.com/containers/), [GA announcement](https://developers.cloudflare.com/changelog/post/2026-04-13-containers-sandbox-ga/), and [scaling/routing](https://developers.cloudflare.com/containers/platform-details/scaling-and-routing/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [R2 Super Slurper](https://developers.cloudflare.com/r2/data-migration/super-slurper/), [Sippy](https://developers.cloudflare.com/r2/data-migration/sippy/), and [S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/), and [object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [Cloudflare storage choices](https://developers.cloudflare.com/workers/platform/storage-options/) and [Hyperdrive database support](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/)
- [D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/) and [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) and [Email Service](https://developers.cloudflare.com/email-service/)

## Unverified assumptions

Phase 0 must resolve these before implementation choices become commitments:

- the external PostgreSQL host is publicly reachable from Containers over approved TLS, or an approved private connectivity path exists;
- production database size, write concurrency, connection demand, dump size/duration, and certificate chain fit the selected database and backup paths;
- no S3 archival, oversized, or metadata edge case falls outside the selected R2 migration path;
- Cloudflare account plan limits, Container quotas, request-body entitlement, and Email Service quota fit observed production traffic;
- one-minute reminder precision and bounded Worker/Queue execution are acceptable for the product;
- hard-coded CloudFront URLs and their underlying distributions can be migrated without breaking historical RSS consumers or persisted content;
- D1's 10 GB cap and serialized-write model fit the workload; this is explicitly not established yet.
