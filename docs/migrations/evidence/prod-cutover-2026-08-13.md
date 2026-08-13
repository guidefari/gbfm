# Production Alchemy cutover — 2026-08-13

Records the first production Alchemy deploy, the D1 import, the email gate's
first real pass, and the findings that cost time and would otherwise be
rediscovered.

`vps.goosebumps.fm` served all real traffic throughout. Nothing user-facing was
switched.

## What went live

| Resource | State |
| --- | --- |
| Worker `gbfm-api-prod-yphgo2gectab2vz5` | live, 38 bindings |
| `api.goosebumps.fm` | bound, proxied AAAA, cert issued |
| D1 `cc3c4fe8-6461-419a-ac1d-3804d47f5238` | all 41 tables imported |
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

## Still open

- Remaining email templates (verification, mix release, reminders) unsent.
- Clients still point at `vps.goosebumps.fm`.
- OPS-256 rate limiting rule.

## R2 content copy — done, but the router is not wired

All production content now lives in the buckets the prod Worker binds:

| Bucket | Objects | Bytes | Method |
| --- | ---: | ---: | --- |
| `gbfm-mixes-prod-krgzgvi7bpxoobjx` | 25 | 3,794,106,703 | R2-to-R2 server-side copy |
| `gbfm-usercontent-prod-2qaxujeklu4sdgz5` | 198 | 983,213,381 | Super Slurper from S3 |

Both match their sources exactly on count and bytes.

**Bucket names are not obvious and cost real time.** Alchemy created
`gbfm-usercontent-prod-2qaxujeklu4sdgz5` and `gbfm-mixes-prod-krgzgvi7bpxoobjx`,
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

### Blocking the `cdn` flip

`r2-cdn.goosebumps.fm` is served by `gbfm-prod-cdnrouterworkerscript`, which is
still declared only in SST (`infra/bucket.ts`) and binds the **old** buckets:

```
MIXES        -> gbfm-mixes
USER_CONTENT -> gbfm-user-content
```

So it does not serve the freshly copied content. A spot check found a live image
404ing through `r2-cdn` while present in the prod bucket; the two assets that did
resolve were coincidences of the old buckets' contents.

The CDN router must be ported into Alchemy and bound to the prod buckets before
`cdn.goosebumps.fm` can be pointed at it. The flip itself is then a DNS change
from the CloudFront/S3 router to the Worker, keeping the same hostname so no
asset URL in the database changes.
