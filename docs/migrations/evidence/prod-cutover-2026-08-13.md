# Production Alchemy cutover — 2026-08-13

Records the first production Alchemy deploy, the D1 import, the email gate's
first real pass, and the findings that cost time and would otherwise be
rediscovered.

`vps.goosebumps.fm` served all real traffic throughout. Nothing user-facing was
switched.

## What went live

| Resource | State |
| --- | --- |
| Worker `gbfm-api-prod-<suffix>` | live, 38 bindings |
| `api.goosebumps.fm` | bound, proxied AAAA, cert issued |
| D1 `<d1-database-id>` | all 41 tables imported |
| Secrets Store | 17 `prod-*` secrets in `default_secrets_store` |
| `EMAIL` binding | bound, routing enabled, DKIM/MX present |

Parity against production: **8 of 14 exact, 2 order-only, 4 with differences**,
all three differences already documented (`tags: [] vs null` history loss,
FTS5-vs-ILIKE search ranking, tie-break ordering that resolves once production
runs this codebase). No new defects.

## Auth: the two findings worth remembering

**The auth base path is `/auth`, not `/api/auth`.** Set by `basePath: '/auth'`
in `apps/server/src/lib/auth.ts`. `POST /api/auth/*` returns 404 with no body,
which reads like a broken deploy rather than a wrong path.

**Password reset is `POST /auth/request-password-reset`**, not
`/auth/forget-password` (404).

**`redirectTo` must be a trusted origin.** An untrusted one fails with:

```json
{"message":"Invalid redirectURL","code":"INVALID_REDIRECT_URL"}
```

The allowed list is `trustedOrigins` in `auth.ts:141-151`: `config.urls.frontend`,
the localhost dev ports, `gbfm.localhost`, `gbfm.test`, and both apex
`goosebumps.fm` forms. **A `*.workers.dev` URL is not trusted**, so testing auth
flows directly against the Worker URL fails on redirect unless `redirectTo`
names a real origin.

**`BETTER_AUTH_URL` must match the deployment.** It sets `baseURL` (`auth.ts:153`),
which is what emailed links are built from. Production's value is correct;
staging's points at the staging Worker. Deploying one stage's value to another
sends users links to the wrong host — the failure appears in the recipient's
mailbox, not in any deploy log.

## Cloudflare credentials: OAuth scopes are the real gate

Alchemy authenticates with a stored **OAuth credential**
(`~/.alchemy/credentials/default/cf-oauth.json`), not `CLOUDFLARE_API_TOKEN`.
Its 26 scopes include `zone:read` and **no email write scope**, so
`POST /zones/{id}/email/routing/enable` returns `Forbidden` inside Alchemy while
succeeding with the API token from a shell.

Re-running `alchemy login` does not help: Cloudflare's OAuth flow for Alchemy
does not offer email scopes.

The fix is Alchemy's `env` auth method, which uses `CLOUDFLARE_API_TOKEN` and
requires `CLOUDFLARE_ACCOUNT_ID` (not the `_DEFAULT_` variant):

```jsonc
// ~/.alchemy/profiles.json
"env-token": { "Cloudflare": { "method": "env" } }
```

```sh
bunx alchemy deploy --stage prod --profile env-token --yes
```

Two account-level token permissions are needed and were both absent initially:

- **Email Sending → Write** (`com.cloudflare.api.account`, id `5df633d6b41c42bcaf5b4a62b9d14b64`)
- **Email Routing Rules → Write** (`com.cloudflare.api.account.zone`, id `79b3ec0d10ce4148a8f8bdc0cc5f97f2`)

Both added 2026-08-13; `GET /zones/{id}/email/sending/subdomains` now returns 200.

## The import script had never actually run

`migrate-pg-to-d1.ts` guards `main()` behind `if (import.meta.main)`. A dynamic
`import()` does not set that, so every invocation exited `ok` in milliseconds
having done nothing — including the reproduction command recorded in
[`d1-drill-rerun-2026-08-13.md`](d1-drill-rerun-2026-08-13.md), which therefore
documents a no-op.

Run it as a real entrypoint:

```sh
D1_DATABASE_ID=<id> CLOUDFLARE_DEFAULT_ACCOUNT_ID=<account> \
  bunx sst shell --stage=prod -- bun -e '
    const env = { ...process.env,
      PG_HOST: process.env.DatabaseHost, PG_USER: process.env.DatabaseUser,
      PG_PASSWORD: process.env.DatabasePassword, PG_PORT: process.env.DatabasePort,
      PG_DATABASE: process.env.DatabaseName, PG_SSL: "true" };
    const p = Bun.spawnSync(["bun", "<abs>/scripts/migrate-pg-to-d1.ts"], { env });
    await Bun.write("/tmp/import-log.txt", p.stdout.toString() + p.stderr.toString());
  '
```

Two more things that block it:

- **`PG_SSL=true` is required.** The source rejects plaintext with
  `SSL/TLS required` (SQLSTATE 28000). The script defaults it off.
- **`sst shell` swallows stdout.** Spawn the script and capture the output, or
  verify by querying the target instead of reading the run.

## Migration ledger baseline

A deployed D1 has its migrations applied by the deploy and recorded in
Cloudflare's `d1_migrations`. The script's own baseline probed schema markers for
`0000` and `0001` only, so `0002` was re-applied and failed with
`duplicate column name: provider`. It now baselines from `d1_migrations` when
that table exists, falling back to the probes for a local target.

## SST config globs every file in `infra/`

`sst.config.ts` imports every file in `infra/` at config-build time. An Alchemy
module placed there pulls `alchemy/Cloudflare` — and therefore `workerd` — into
SST's bundle and breaks `sst shell` entirely:

```
✕ Failed to build sst.config.ts
  workerd/lib/main.js:2:1 Syntax error "!"
```

Since `sst shell` is the only way to read production secrets, this breaks the
import path too. Alchemy-side modules live in `alchemy/`, not `infra/`.

## Email gate: first real pass

One `TRANSACTIONAL` password-reset email sent to the controlled mailbox at
18:35:28 and confirmed received.

```
status: SENT   provider: cloudflare   errorMessage: null
```

The `provider: cloudflare` column distinguishes it from the older SES-era rows,
which have `provider: null`. Routing reports `enabled: true, status: ready`.

Email routing was enabled by a direct API call because Alchemy's OAuth
credential could not; the resource is now manageable with the added permissions.

Note: [`email-staging-gate.md`](email-staging-gate.md) still describes a separate
`email-staging` stage that was deliberately abandoned in favour of a single
staging environment. It needs rewriting against the one-stage reality before it
can be signed off.

## The client cutover: goosebumps.fm now runs on Alchemy

`www.goosebumps.fm` and the apex are served by the Alchemy site Worker,
built with `VITE_VPS_BASE_URL=https://api.goosebumps.fm`. The VPS no longer
receives browser traffic.

**Attaching a hostname that another Worker owns fails, by design:**

```
Cannot attach hostname 'www.goosebumps.fm' to Worker '...': it is already
attached to Worker 'gbfm-prod-gbfmwwwrouterscript'.
```

The deploy stopped there and left the site up. As with `cdn`, the sequence is
detach then reattach, and **the site is down in between**, so run them back to
back:

```sh
# rollback state: both were attached to gbfm-prod-gbfmwwwrouterscript
DELETE /accounts/{account}/workers/domains/<apex-domain-binding-id>  # apex
DELETE /accounts/{account}/workers/domains/<www-domain-binding-id>  # www
```

Rollback is re-attaching those two hostnames to the SST Worker, which is still
deployed.

**The CAA records look like a blocker and are not.** The zone pins issuance to
`amazonaws.com`, but every hostname Cloudflare already serves (`api`, `cdn`, and
the site itself) presents a Google Trust Services certificate. The records are
stale AWS leftovers.

**A preview URL cannot fully verify the client.** On its `workers.dev` URL the
new build's API calls failed: preflight returned 204, then the GET was rejected
because that origin is not in `trustedOrigins` (`auth.ts:141-151`). The same
call from `www.goosebumps.fm` returns 200 with
`access-control-allow-origin` set, and the payload is byte-identical to the VPS
apart from a `playCount` the check itself incremented. So the CORS failure is an
artifact of the preview origin and resolves at the real hostname, but it does
mean **the client can only be fully verified after the hostname moves**.

Verified after the takeover, in a browser: cover art renders, a mix streams and
advances, `/shows` lists shows with episodes and thumbnails, and
`/api/shows`, `/api/shows/:slug/episodes` and `/auth/get-session` all return 200
from `api.goosebumps.fm`.

Also moved with the client:

- The dynamic-redirect ruleset (`/rss.xml`, `/sitemap.xml`, `/s/*`) now targets
  the API. `goosebumps.fm/rss.xml` redirects to `api.goosebumps.fm/rss.xml` and
  serves the feed.
- `api.goosebumps.fm` added to Sentry's `tracePropagationTargets`
  (`apps/www/src/main.tsx`), which otherwise silently drops distributed tracing
  once the client stops calling the VPS.

### BETTER_AUTH_URL pointed at staging

Production's stored value was
`https://<staging-worker>.workers.dev`, so emailed
password-reset and verification links were built for a **staging** Worker. This
was a live defect, not a migration artifact, and it survived an earlier check
here that confirmed the value's length without looking at its host.

It is now derived from the stack (`alchemy.run.ts` passes `apiUrl` into
`secretsStore`) rather than inherited from the environment, so it cannot drift
to whatever a shell happened to export.

### CI deploys need every secret, not two

The goal was two GitHub secrets. It is not reachable on this Alchemy beta:

- `value` is a **required** input on `Cloudflare.SecretsStore.Secret`, and
  `ReadSecret` takes a `Secret` resource, so neither can bind by name alone.
- Secret bindings are declared by the Worker's `env`. Omitting them does not
  preserve what is deployed: it **removes all 18 bindings** and the Worker boots
  with no database password.

`diff` does compare against state, so unchanged values are a true no-op and a
deploy with correct values costs nothing. But the values must be present.
`.github/workflows/alchemy-deploy.yml` therefore carries all 17, gated on the
`production` environment, and fails the run if `api`, `cdn` or `www` stop
serving after the deploy.

## Still open

- Remaining email templates (verification, mix release, reminders) unsent.
- `infra/cron.ts` still runs the hourly Bluesky sync on AWS.
- `infra/vps.ts` and `infra/dev.script.ts` not ported; `sst remove` last.
- OPS-256 rate limiting rule.

## R2 content copy — done, but the router is not wired

All production content now lives in the buckets the prod Worker binds:

| Bucket | Objects | Bytes | Method |
| --- | ---: | ---: | --- |
| `gbfm-mixes-prod-<suffix>` | 25 | 3,794,106,703 | R2-to-R2 server-side copy |
| `gbfm-usercontent-prod-<suffix>` | 198 | 983,213,381 | Super Slurper from S3 |

Both match their sources exactly on count and bytes.

**Bucket names are not obvious and cost real time.** Alchemy created
`gbfm-usercontent-prod-<suffix>` and `gbfm-mixes-prod-<suffix>`,
while the SST-era buckets are `gbfm-user-content` and `gbfm-mixes`. Read the
Worker's bindings before copying anything:

```sh
GET /accounts/{account}/workers/scripts/{script}/bindings
```

**Super Slurper drops `Content-Type` on multipart uploads.** Six large MP3s
arrived with no content type, the same defect recorded in
[`r2-mixes-copy-2026-08-09.md`](r2-mixes-copy-2026-08-09.md). Repaired with
same-bucket `CopyObject` using `MetadataDirective: REPLACE`, reading the true
type from the S3 source. Verify with `http_metadata.contentType` over the
object listing before considering a copy finished.

Super Slurper's job API nests credentials under `source.secret` / `target.secret`
and rejects `target.accountId`.

### CDN router ported to Alchemy

`r2-cdn.goosebumps.fm` was served by `gbfm-prod-cdnrouterworkerscript`, declared
only in SST (`infra/bucket.ts`) and bound to the **old** buckets (`gbfm-mixes`,
`gbfm-user-content`). It therefore did not serve the freshly copied content: a
live image 404'd through `r2-cdn` while present in the prod bucket, and the two
assets that did resolve were coincidences of the old buckets' contents.

The router source was already portable, so the port was a stack declaration
only. It is now `CdnRouter` in `alchemy.run.ts`, bound to the same `UserContent`
and `Mixes` resources the API Worker uses, published to a **staging hostname**
so it could be verified before anything user-facing moved:

```
https://r2-cdn-next.goosebumps.fm   ->  gbfm-cdnrouter-prod-<suffix>
  USER_CONTENT -> gbfm-usercontent-prod-<suffix>
  MIXES        -> gbfm-mixes-prod-<suffix>
```

Verified against the new hostname:

| Check | Result |
| --- | --- |
| The image that 404'd on the old router | `200`, 175,825 bytes, `image/jpeg` |
| 18 sampled keys across both prefixes | 18/18 `200` with correct content types |
| SHA-256 vs live `cdn.goosebumps.fm` | identical (2 images, plus an 8 MB audio prefix) |
| Range, conditional, HEAD | `206` with correct `content-range`, `304`, `200` |
| `POST`, missing key, bare prefix, unrouted path | `405`, `404`, `404`, `404` |

**CORS was a gap the port would have introduced.** The CloudFront CDN sends
`access-control-allow-origin: *` today; the Worker sent nothing. Nothing in the
client currently needs it (`new Audio()` in `PlayerProvider.tsx:87` sets no
`crossOrigin`, and there is no `AudioContext` or `fetch` of CDN media), but
flipping would have silently dropped a header production has always sent. The
router now sends CORS on every path, 304 included, which is worth an explicit
test because a `Response` can carry immutable headers.

### The flip, done

`cdn.goosebumps.fm` now serves from the R2-backed Worker. The hostname is
unchanged, so no asset URL in the database was touched.

**It is a Worker custom domain, not a DNS edit.** The zone has no worker routes;
every Worker hostname is an entry in
`/accounts/{account}/workers/domains`. `cdn.goosebumps.fm` was an *unproxied*
`CNAME` to `<distribution>.cloudfront.net`, and Cloudflare will not attach a
custom domain over an existing record. So the sequence is:

1. delete the CloudFront `CNAME`
2. deploy with `domain: 'cdn.goosebumps.fm'` on the router

Alchemy then creates the proxied `AAAA 100::` and issues the cert. **The
hostname is down between those two steps**, so run them back to back.

Rollback is recreating the record exactly as it was, which is why it is written
down here verbatim:

```json
{ "type": "CNAME", "name": "cdn.goosebumps.fm",
  "content": "<distribution>.cloudfront.net", "proxied": false, "ttl": 60 }
```

CloudFront and the S3 origin are untouched and still serve, so rollback stays
available until they are deliberately torn down.

Verified after the flip: 17/17 sampled assets `200` across both prefixes, range
requests `206` with the correct `content-range`, CORS present, and the
certificate verifying (`ssl_verify_result: 0`) from two different Cloudflare
edge IPs.

**A stale local resolver will make a healthy flip look like an outage.** Deleting
the `CNAME` left this machine caching `NXDOMAIN`, so every request returned
`status=000` / `Could not resolve host` while the hostname was serving fine
worldwide. Confirm against `1.1.1.1`, `dns.google`, or the authoritative
nameservers, and fetch with `curl --resolve` to bypass the local cache before
concluding anything is broken.
