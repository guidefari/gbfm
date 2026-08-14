# Production deployment gate

> **Retired 2026-08-14.** The `Prod Deployment` workflow
> (`.github/workflows/deploy.yml`) was deleted along with the SST deploy path.
> Its gate verified an ECS service that production no longer runs. The section
> below is kept as a record of what it checked; see
> [Current checks](#current-checks) for what actually gates deploys today.

## Current checks

`.github/workflows/alchemy-deploy.yml` gates production. Before deploying it
fails closed on any missing repository secret, because Alchemy patches a secret
whose value differs from its state and an unset variable would reach Cloudflare
as an empty string. After deploying it probes, with retries:

| Endpoint | Expected |
| --- | --- |
| `https://api.goosebumps.fm/health` | 200 |
| `https://api.goosebumps.fm/api/shows` | 200 |
| `https://cdn.goosebumps.fm/mixes/gb52.mp3` | 200 |
| `https://www.goosebumps.fm/` | 200 |
| `https://goosebumps.fm/rss.xml` | 301 |

`/health` caches its readiness result for 5 seconds, so a probe landing inside
the deploy window can serve a stale failure from an already-healthy Worker.
The retry loop exists for that, not for flakiness in general.

There is no Sentry span assertion in the current gate. The tracing invariants
described below were never ported to the Worker deploy path.

## Historical: the SST gate

The `Prod Deployment` workflow verified the deployment after SST finished. A
deployment was successful only when all of these checks passed:

1. The SST-tagged production ECS service has one completed primary deployment,
   its desired tasks are running, it has no pending or failed tasks, and its
   task definition contains the exact `SENTRY_RELEASE` being deployed.
2. `https://vps.goosebumps.fm/health` returns a valid ready response.
3. A traced request to `/api/profile/guidefari` returns a valid public profile.
4. Sentry receives parented `db.query` spans for that request's unique trace and
   exact release.
5. Those spans contain the manual GBFM instrumentation marker and only
   normalized database metadata. Raw SQL fields, unparented spans, mismatched
   correlation fields, spans without the marker, and unsanitized
   `span.op:db` spans fail the deployment.

The gate wrote its evidence or safe failure summary to the GitHub Actions step
summary. It ran only in CI after a deployment and added no work to production
request handling beyond its single profile probe.

Its implementation, `apps/server/scripts/verify-production-deployment.ts`, is
now orphaned: nothing invokes it, and the ECS service it inspects is scheduled
for teardown. It targets `vps.goosebumps.fm`, which the teardown removes.

### Secrets it required

- `AWS_ROLE_ARN`: the production deployment role. In addition to its SST
  deployment permissions, it needed `tag:GetResources`, `ecs:DescribeServices`
  and `ecs:DescribeTaskDefinition`.
- `SENTRY_AUTH_TOKEN`: an `org:ci` organization token used only to publish
  release metadata.
- `SENTRY_OBSERVABILITY_TOKEN`: a separate personal token with only `org:read`,
  used to query Sentry Explore spans.

The Sentry observability token was wrapped as an Effect `Redacted` value and
only unwrapped while constructing the authorization header. Dependency errors
and workflow summaries never included response bodies, command stderr, or
credentials. AWS CLI failures could include only the bounded AWS error code,
such as `AccessDeniedException`.

### Timing

ECS stability had a 28-attempt budget (up to 6 minutes 45 seconds of polling
sleep). Sentry ingestion had its own 16-attempt budget (up to 3 minutes 45
seconds), followed by an independent 8-attempt settlement budget (up to 1
minute 45 seconds). The gate required three identical, fully valid span
snapshots before the unsanitized database-span invariant was checked. A response
that reached Sentry's 100-span page boundary failed closed instead of validating
a partial result. The internal timeout was derived from those three polling
budgets plus five minutes for AWS, HTTP, and Sentry request latency; the final
configuration was 17 minutes 15 seconds, preserving failure reporting before the
workflow step's 20-minute outer timeout.
