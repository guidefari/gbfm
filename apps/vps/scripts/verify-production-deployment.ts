import { appendFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { Effect, Redacted, Schema } from 'effect'
import {
  ProductionVerificationError,
  type ProductionVerificationConfig,
  type ProductionVerificationReport,
  verifyProductionDeployment
} from '../src/ops/production-verification'
import { makeProductionVerificationLive } from './production-verification-live'

const Environment = Schema.Struct({
  AWS_REGION: Schema.NonEmptyString,
  PRODUCTION_BASE_URL: Schema.URLFromString,
  SENTRY_AUTH_TOKEN: Schema.RedactedFromValue(Schema.NonEmptyString),
  SENTRY_ENVIRONMENT: Schema.NonEmptyString,
  SENTRY_ORG: Schema.NonEmptyString,
  SENTRY_PROJECT_ID: Schema.NonEmptyString,
  SENTRY_RELEASE: Schema.NonEmptyString,
  SST_APP: Schema.NonEmptyString,
  SST_STAGE: Schema.NonEmptyString
})

const safeFailureSummary = (error: unknown) =>
  error instanceof ProductionVerificationError
    ? `${error.phase}: ${error.summary}`
    : 'configuration: unexpected production verification defect'

const reportMarkdown = (report: ProductionVerificationReport) => `## Production verification

| Gate | Evidence |
| --- | --- |
| Release | \`${report.release}\` |
| ECS | One completed deployment, task \`${report.taskDefinition.split('/').at(-1) ?? report.taskDefinition}\` |
| Health probe | HTTP ${report.healthStatus} |
| Profile probe | HTTP ${report.profileStatus} |
| Sentry trace | \`${report.traceId}\` |
| Safe database spans | ${report.databaseSpanCount} parented \`db.query\` span(s), zero forbidden \`db\` spans |
`

const failureMarkdown = (summary: string) => `## Production verification

❌ ${summary}
`

const appendSummary = (markdown: string) =>
  Effect.tryPromise({
    try: async () => {
      const summaryPath = process.env.GITHUB_STEP_SUMMARY
      if (summaryPath !== undefined && summaryPath.length > 0) {
        await appendFile(summaryPath, markdown)
      }
    },
    catch: () =>
      new ProductionVerificationError({
        phase: 'configuration',
        summary: 'Could not write the GitHub Actions step summary'
      })
  })

const program = Effect.gen(function* () {
  const environment = yield* Schema.decodeUnknownEffect(Environment)(process.env).pipe(
    Effect.mapError(
      () =>
        new ProductionVerificationError({
          phase: 'configuration',
          summary: 'Production verification environment is missing or invalid'
        })
    )
  )

  const config: ProductionVerificationConfig = {
    app: environment.SST_APP,
    stage: environment.SST_STAGE,
    environment: environment.SENTRY_ENVIRONMENT,
    release: environment.SENTRY_RELEASE,
    baseUrl: environment.PRODUCTION_BASE_URL,
    profilePath: '/api/profile/guidefari',
    traceId: randomBytes(16).toString('hex'),
    parentSpanId: randomBytes(8).toString('hex'),
    ecs: {
      attempts: 40,
      intervalMs: 15_000
    },
    sentry: {
      attempts: 20,
      intervalMs: 15_000
    }
  }

  const report = yield* verifyProductionDeployment(config).pipe(
    Effect.provide(
      makeProductionVerificationLive({
        awsRegion: environment.AWS_REGION,
        sentryOrg: environment.SENTRY_ORG,
        sentryProjectId: environment.SENTRY_PROJECT_ID,
        sentryToken: environment.SENTRY_AUTH_TOKEN
      })
    )
  )

  yield* Effect.logInfo('Production verification passed', {
    release: report.release,
    taskDefinition: report.taskDefinition,
    traceId: report.traceId,
    databaseSpanCount: report.databaseSpanCount
  })
  yield* appendSummary(reportMarkdown(report))
  return report
})

try {
  await Effect.runPromise(program)
} catch (error: unknown) {
  const summary = safeFailureSummary(error)
  console.error(`Production verification failed: ${summary}`)
  await Effect.runPromise(appendSummary(failureMarkdown(summary))).catch(() => undefined)
  process.exitCode = 1
}
