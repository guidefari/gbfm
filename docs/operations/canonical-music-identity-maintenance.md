# Canonical music identity maintenance

The maintenance command never calls a music provider, creates or merges music entities, changes links, or takes ownership from a canonical caller. Backfill is read-only unless `--apply` is present.

Applied backfill uses a durable generation with three phases:

1. `scan_links` reads bounded `(createdAt, id)` pages up to a captured high-water mark and stages parsed candidates once.
2. `scan_claims` reads bounded completed legacy-claim pages up to a captured high-water mark.
3. `apply` reads bounded global source-key pages, ranks staged candidates, revalidates each winner against live links, claims, entities, identities, aliases, and leases, then writes one atomic D1 batch.

The generation ID, staged candidates, findings, action ledger, and cursor prevent generations from mixing. Page writes and cursor advancement are in the same D1 batch. The REST adapter sends D1's `{ batch: [...] }` request and rejects any result whose `success` flag is false. If a request fails, rerun the same generation.

Links or claims written after a generation's high-water marks are left for a later generation. A removed or changed link is no longer eligible at apply time, so maintenance cannot resurrect released ownership. Existing resolved identities always outrank staged candidates. Resolving leases remain untouched and are durably recorded as active or expired findings.

## Required environment

Set the target and the expected ID for its environment:

```sh
export CLOUDFLARE_ACCOUNT_ID='<account-id>'
export CLOUDFLARE_API_TOKEN='<scoped-d1-token>'
export D1_DATABASE_ID='<staging-database-id>'
export D1_STAGING_DATABASE_ID='<staging-database-id>'
export D1_PRODUCTION_DATABASE_ID='<production-database-id>'
export D1_ENVIRONMENT='staging'
```

Valid expected-ID variables are `D1_DEVELOPMENT_DATABASE_ID`, `D1_STAGING_DATABASE_ID`, and `D1_PRODUCTION_DATABASE_ID`. The production ID is required for every environment. The command requires exact equality between `D1_DATABASE_ID` and the variable selected by `--environment`, and rejects the known production ID for non-production runs.

Use a token scoped to the intended account and database.

## Dry-run preview

Dry run is the default. It reads one bounded link page and writes nothing:

```sh
cd apps/server
bun run identity:maintain backfill --environment=staging --batch-size=25
```

Use both returned link cursor parts to preview the next page:

```sh
bun run identity:maintain backfill --environment=staging --batch-size=25 \
  --cursor-created-at=1780000000000 --cursor-id='<last-link-id>'
```

Preview counts are page-local:

- `scanned`: links read
- `candidates`: compatible parsed links
- `proposed`: distinct source keys on the page
- `attempted`: always zero
- `detected`: issues in the page
- `conflicted`: findings in the `collision` or `duplicate_ownership_candidate` categories
- `identitiesCreated`, `aliasesCreated`, `aliasesTouched`: always zero

## Applied staging run

Start or resume the active generation:

```sh
bun run identity:maintain backfill --environment=staging --batch-size=25 --apply
```

Keep the returned `generationId` and pass it on every later invocation:

```sh
bun run identity:maintain backfill --environment=staging --batch-size=25 --apply \
  --generation-id='<generation-id>'
```

Repeat until `phase` is `complete`. Scan and audit pages use `--batch-size`; apply pages cap each atomic REST batch at five source keys to keep request size bounded. Counts then mean:

- `scanned`: staged link and compatible completed-claim rows examined
- `candidates`: candidates materialized
- `proposed`: distinct staged source keys, not writes
- `attempted`: source keys whose live apply decision committed
- `detected`: unique durable findings
- `conflicted`: durable findings in the `collision` or `duplicate_ownership_candidate` categories
- `identitiesCreated`: identity rows actually created by this generation
- `aliasesCreated`: alias rows actually created by this generation
- `aliasesTouched`: existing same-owner aliases whose `last_seen_at` actually advanced
- `invalid`, `orphaned`: detected scan rows

Actual write counts come from the action ledger in the same atomic transaction as each write. Retries do not inflate them.

## Bounded audit

Audit reads one bounded phase page per invocation. Select a phase and pass its returned cursor to continue:

```sh
bun run identity:maintain audit --environment=staging --phase=links --batch-size=25
bun run identity:maintain audit --environment=staging --phase=conflicts --batch-size=25 \
  --cursor='<returned-cursor>'
bun run identity:maintain audit --environment=staging --phase=findings --batch-size=25 \
  --generation-id='<completed-generation-id>'
```

Phases are `links`, `identities`, `aliases`, `conflicts`, `leases`, and `findings`. Output never contains more than one page. `findings` reads durable findings from the selected generation, or from the active generation when `--generation-id` is omitted.

Audits are live bounded observations, not a database snapshot. Concurrent writes may appear in a later pass. Run every phase again after canonical write traffic is quiescent before declaring the audit clean.

## Production safeguard

Production reads and writes require all of:

- `D1_ENVIRONMENT=production`
- `D1_DATABASE_ID` exactly equal to `D1_PRODUCTION_DATABASE_ID`
- `--environment=production`
- `--confirm-production=I_UNDERSTAND_IDENTITY_MAINTENANCE_PRODUCTION`

A production backfill still remains read-only without `--apply`. Do not run production maintenance until migration `0007_music_identity_backfill_checkpoint.sql` has deployed through the normal migration process and staging evidence has been reviewed.
