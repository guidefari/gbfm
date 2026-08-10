import { appendFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { PUBLIC_PROFILE_PATH } from '@gbfm/api/profile'
import { Cause, Effect, Exit, Schema } from 'effect'
import {
  ProductionVerificationError,
  type ProductionVerificationConfig,
  type ProductionVerificationReport,
  summarizeProductionVerificationFailure,
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

const VERIFICATION_REQUEST_HEADROOM_MS = 5 * 60_000

const verificationTimeoutMs = (config: ProductionVerificationConfig) =>
  Math.max(0, config.ecs.attempts - 1) * config.ecs.intervalMs +
  Math.max(0, config.sentry.ingestionAttempts - 1) * config.sentry.intervalMs +
  Math.max(0, config.sentry.settlementAttempts - 1) * config.sentry.intervalMs +
  VERIFICATION_REQUEST_HEADROOM_MS

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
    profilePath: PUBLIC_PROFILE_PATH.replace(':username', 'guidefari'),
    profileTransaction: `GET ${PUBLIC_PROFILE_PATH}`,
    traceId: randomBytes(16).toString('hex'),
    parentSpanId: randomBytes(8).toString('hex'),
    ecs: {
      attempts: 28,
      intervalMs: 15_000
    },
    sentry: {
      ingestionAttempts: 16,
      intervalMs: 15_000,
      settlementAttempts: 8
    }
  }
  const timeoutMs = verificationTimeoutMs(config)

  const report = yield* verifyProductionDeployment(config).pipe(
    Effect.provide(
      makeProductionVerificationLive({
        awsRegion: environment.AWS_REGION,
        sentryOrg: environment.SENTRY_ORG,
        sentryProjectId: environment.SENTRY_PROJECT_ID,
        sentryToken: environment.SENTRY_AUTH_TOKEN
      })
    ),
    Effect.timeout(timeoutMs),
    Effect.mapError((error) =>
      error instanceof ProductionVerificationError
        ? error
        : new ProductionVerificationError({
            phase: 'verification-timeout',
            summary: `Production verification exceeded its ${timeoutMs}ms internal timeout`
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

const reportFailure = async (error: unknown) => {
  const summary = summarizeProductionVerificationFailure(error)
  console.error(`Production verification failed: ${summary}`)
  await Effect.runPromise(appendSummary(failureMarkdown(summary))).catch(() => undefined)
  process.exitCode = 1
}

const exit = await Effect.runPromiseExit(program)
if (Exit.isFailure(exit)) {
  const failure = exit.cause.reasons.find(Cause.isFailReason)
  await reportFailure(failure?.error)
}
