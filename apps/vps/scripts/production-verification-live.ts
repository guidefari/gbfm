import { Effect, Layer, Redacted } from 'effect'
import {
  ProductionVerificationError,
  ProductionVerificationPort,
  type ProductionVerificationPort as ProductionVerificationPortShape
} from '../src/ops/production-verification'

const SENTRY_SPAN_FIELDS = [
  'id',
  'parent_span',
  'span.op',
  'description',
  'transaction',
  'trace',
  'release',
  'environment',
  'db.system.name',
  'db.operation.name',
  'db.collection.name',
  'db.query.summary',
  'gbfm.db.instrumentation',
  'db.statement',
  'db.query',
  'db.query.text'
] as const

type LiveVerificationConfig = {
  readonly awsRegion: string
  readonly sentryOrg: string
  readonly sentryProjectId: string
  readonly sentryToken: Redacted.Redacted<string>
}

const dependencyFailure = (
  phase:
    | 'resource-discovery'
    | 'ecs-rollout'
    | 'health-probe'
    | 'profile-probe'
    | 'sentry-ingestion',
  summary: string
) => new ProductionVerificationError({ phase, summary })

const safeAwsErrorCode = (standardError: string) =>
  /An error occurred \(([A-Za-z0-9._-]+)\)/.exec(standardError)?.[1]

class SafeAwsCliError extends Error {
  readonly code: string | undefined

  constructor(code: string | undefined) {
    super('AWS CLI request failed')
    this.code = code
  }
}

const runAwsJson = (
  region: string,
  phase: 'resource-discovery' | 'ecs-rollout',
  args: ReadonlyArray<string>
): Effect.Effect<unknown, ProductionVerificationError> =>
  Effect.tryPromise({
    try: async () => {
      const child = Bun.spawn(
        [
          'aws',
          ...args,
          '--region',
          region,
          '--output',
          'json',
          '--no-cli-pager',
          '--cli-connect-timeout',
          '10',
          '--cli-read-timeout',
          '30'
        ],
        {
          stdout: 'pipe',
          stderr: 'pipe'
        }
      )
      const [stdout, standardError, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited
      ])

      if (exitCode !== 0) {
        throw new SafeAwsCliError(safeAwsErrorCode(standardError))
      }
      const output: unknown = JSON.parse(stdout)
      return output
    },
    catch: (error) => {
      const code = error instanceof SafeAwsCliError ? error.code : undefined
      return dependencyFailure(
        phase,
        code === undefined ? 'AWS CLI request failed' : `AWS CLI request failed (${code})`
      )
    }
  })

const fetchJson = (
  request: Request,
  phase: 'health-probe' | 'profile-probe' | 'sentry-ingestion'
) =>
  Effect.tryPromise({
    try: (signal) =>
      fetch(request, { signal }).then(async (response) => {
        const body: unknown = await response.json()
        return { response, body }
      }),
    catch: () => dependencyFailure(phase, 'HTTP request failed')
  }).pipe(
    Effect.timeout('30 seconds'),
    Effect.mapError((error) =>
      error instanceof ProductionVerificationError
        ? error
        : dependencyFailure(phase, 'HTTP request timed out')
    )
  )

/**
 * Creates the live AWS, production HTTP, and Sentry adapter layer.
 */
export const makeProductionVerificationLive = (
  config: LiveVerificationConfig
): Layer.Layer<ProductionVerificationPort> =>
  Layer.succeed(ProductionVerificationPort, {
    discoverEcsResources: (app, stage) =>
      runAwsJson(config.awsRegion, 'resource-discovery', [
        'resourcegroupstaggingapi',
        'get-resources',
        '--tag-filters',
        `Key=sst:app,Values=${app}`,
        `Key=sst:stage,Values=${stage}`,
        '--resource-type-filters',
        'ecs:cluster',
        'ecs:service'
      ]),
    describeEcsService: ({ clusterArn, serviceArn }) =>
      runAwsJson(config.awsRegion, 'ecs-rollout', [
        'ecs',
        'describe-services',
        '--cluster',
        clusterArn,
        '--services',
        serviceArn
      ]),
    describeTaskDefinition: (taskDefinitionArn) =>
      runAwsJson(config.awsRegion, 'ecs-rollout', [
        'ecs',
        'describe-task-definition',
        '--task-definition',
        taskDefinitionArn
      ]),
    probe: ({ url, traceparent }) => {
      const headers = new Headers()
      if (traceparent !== undefined) headers.set('traceparent', traceparent)

      const phase = url.pathname === '/health' ? 'health-probe' : 'profile-probe'
      return fetchJson(new Request(url.toString(), { headers }), phase).pipe(
        Effect.map(({ body, response }) => ({ body, status: response.status }))
      )
    },
    querySpans: ({ environment, operation, release, traceId }) => {
      const url = new URL(
        `/api/0/organizations/${encodeURIComponent(config.sentryOrg)}/events/`,
        'https://sentry.io'
      )
      url.searchParams.set('dataset', 'spans')
      url.searchParams.set('project', config.sentryProjectId)
      url.searchParams.set('environment', environment)
      url.searchParams.set('statsPeriod', '1h')
      url.searchParams.set('per_page', '100')
      url.searchParams.set('query', `trace:${traceId} release:${release} span.op:${operation}`)
      for (const field of SENTRY_SPAN_FIELDS) url.searchParams.append('field', field)

      const request = new Request(url.toString(), {
        headers: {
          authorization: `Bearer ${Redacted.value(config.sentryToken)}`,
          'cache-control': 'no-cache'
        }
      })
      return fetchJson(request, 'sentry-ingestion').pipe(
        Effect.flatMap(({ body, response }) =>
          response.ok
            ? Effect.succeed(body)
            : Effect.fail(
                dependencyFailure(
                  'sentry-ingestion',
                  `Sentry spans request returned HTTP ${response.status}`
                )
              )
        )
      )
    },
    wait: (milliseconds) => Effect.sleep(milliseconds)
  } satisfies ProductionVerificationPortShape)
