# Production deployment gate

The `Prod Deployment` workflow verifies the deployment after SST finishes. A
deployment is successful only when all of these checks pass:

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

The gate writes its evidence or safe failure summary to the GitHub Actions step
summary. It runs only in CI after a deployment and adds no work to production
request handling beyond its single profile probe.

## Required GitHub Actions secrets

- `AWS_ROLE_ARN`: the existing production deployment role. In addition to its
  SST deployment permissions, it must allow `tag:GetResources` and
  `ecs:DescribeServices` and `ecs:DescribeTaskDefinition`.
- `SENTRY_AUTH_TOKEN`: an `org:ci` organization token used only to publish
  release metadata.
- `SENTRY_OBSERVABILITY_TOKEN`: a separate personal token with only `org:read`,
  used to query Sentry Explore spans. Do not broaden or reuse the release token.

The Sentry observability token is wrapped as an Effect `Redacted` value and is
only unwrapped while constructing the authorization header. Dependency errors
and workflow summaries never include response bodies, command stderr, or
credentials. AWS CLI failures may include only the bounded AWS error code, such
as `AccessDeniedException`.

## Timing

ECS stability is polled for up to 10 minutes. Sentry ingestion is polled for up
to 5 minutes, followed by a settlement interval that revalidates the complete
indexed span set before the unsanitized database-span invariant is checked. An
18-minute internal timeout preserves the failure summary before the workflow
step's 20-minute outer timeout.
