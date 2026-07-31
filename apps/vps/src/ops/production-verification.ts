import { HealthReadyResponse } from '@gbfm/api/health'
import { PublicProfileResponse } from '@gbfm/api/profile'
import { Context, Data, Effect, Schema } from 'effect'

const TaggedResourceResponse = Schema.Struct({
  ResourceTagMappingList: Schema.Array(
    Schema.Struct({
      ResourceARN: Schema.String
    })
  )
})

const EcsDeployment = Schema.Struct({
  status: Schema.String,
  rolloutState: Schema.String,
  runningCount: Schema.Number,
  pendingCount: Schema.Number,
  failedTasks: Schema.Number,
  taskDefinition: Schema.String
})

const DescribeServicesResponse = Schema.Struct({
  services: Schema.Array(
    Schema.Struct({
      clusterArn: Schema.String,
      serviceArn: Schema.String,
      desiredCount: Schema.Number,
      runningCount: Schema.Number,
      pendingCount: Schema.Number,
      deployments: Schema.Array(EcsDeployment)
    })
  ),
  failures: Schema.Array(Schema.Unknown)
})

const DescribeTaskDefinitionResponse = Schema.Struct({
  taskDefinition: Schema.Struct({
    containerDefinitions: Schema.Array(
      Schema.Struct({
        environment: Schema.Array(
          Schema.Struct({
            name: Schema.String,
            value: Schema.String
          })
        )
      })
    )
  })
})

const SentrySpan = Schema.Struct({
  id: Schema.String,
  parent_span: Schema.NullOr(Schema.String),
  'span.op': Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  transaction: Schema.NullOr(Schema.String),
  trace: Schema.String,
  release: Schema.String,
  environment: Schema.String,
  'db.system.name': Schema.NullOr(Schema.String),
  'db.operation.name': Schema.NullOr(Schema.String),
  'db.collection.name': Schema.NullOr(Schema.String),
  'db.query.summary': Schema.NullOr(Schema.String),
  'gbfm.db.instrumentation': Schema.NullOr(Schema.String),
  'db.statement': Schema.NullOr(Schema.String),
  'db.query': Schema.NullOr(Schema.String),
  'db.query.text': Schema.NullOr(Schema.String)
})

const SentrySpansResponse = Schema.Struct({
  data: Schema.Array(SentrySpan)
})

const SAFE_DATABASE_OPERATION = /^(?:SELECT|INSERT|UPDATE|DELETE|QUERY)$/
const SAFE_DATABASE_COLLECTION = /^(?:unknown|[A-Za-z_][\w$]*)$/
const SAFE_DATABASE_SUMMARY = /^(?:SELECT|INSERT|UPDATE|DELETE|QUERY)(?: [A-Za-z_][\w$]*)?$/
const REQUIRED_STABLE_SENTRY_POLLS = 3

type VerificationPhase =
  | 'configuration'
  | 'resource-discovery'
  | 'ecs-rollout'
  | 'health-probe'
  | 'profile-probe'
  | 'sentry-ingestion'
  | 'sentry-correlation'
  | 'sentry-privacy'
  | 'verification-timeout'

type EcsResources = {
  readonly clusterArn: string
  readonly serviceArn: string
}

type ProbeRequest = {
  readonly url: URL
  readonly traceparent?: string
}

type ProbeResponse = {
  readonly status: number
  readonly body: unknown
}

type SpanQuery = {
  readonly environment: string
  readonly operation: 'db.query' | 'db'
  readonly release: string
  readonly traceId: string
}

/**
 * Safe expected failure from the production deployment verification gate.
 */
export class ProductionVerificationError extends Data.TaggedError('ProductionVerificationError')<{
  readonly phase: VerificationPhase
  readonly summary: string
}> {}

/**
 * Converts a typed verifier failure into a credential-safe operator summary.
 */
export const summarizeProductionVerificationFailure = (error: unknown) =>
  error instanceof ProductionVerificationError
    ? `${error.phase}: ${error.summary}`
    : 'configuration: unexpected production verification defect'

/**
 * Runtime configuration for one production verification run.
 */
export type ProductionVerificationConfig = {
  readonly app: string
  readonly stage: string
  readonly environment: string
  readonly release: string
  readonly baseUrl: URL
  readonly profilePath: string
  readonly profileTransaction: string
  readonly traceId: string
  readonly parentSpanId: string
  readonly ecs: {
    readonly attempts: number
    readonly intervalMs: number
  }
  readonly sentry: {
    readonly attempts: number
    readonly intervalMs: number
  }
}

/**
 * External operations used by the deployment verifier.
 *
 * Implementations return unknown AWS and Sentry payloads so the verifier owns
 * boundary parsing and cannot accidentally trust third-party response shapes.
 */
export interface ProductionVerificationPort {
  readonly discoverEcsResources: (
    app: string,
    stage: string
  ) => Effect.Effect<unknown, ProductionVerificationError>
  readonly describeEcsService: (
    resources: EcsResources
  ) => Effect.Effect<unknown, ProductionVerificationError>
  readonly describeTaskDefinition: (
    taskDefinitionArn: string
  ) => Effect.Effect<unknown, ProductionVerificationError>
  readonly probe: (
    request: ProbeRequest
  ) => Effect.Effect<ProbeResponse, ProductionVerificationError>
  readonly querySpans: (query: SpanQuery) => Effect.Effect<unknown, ProductionVerificationError>
  readonly wait: (milliseconds: number) => Effect.Effect<void>
}

/**
 * Effect service seam for production AWS, HTTP, and Sentry operations.
 */
export const ProductionVerificationPort = Context.Service<ProductionVerificationPort>(
  'ProductionVerificationPort'
)

/**
 * Safe evidence emitted by a successful production verification run.
 */
export type ProductionVerificationReport = {
  readonly release: string
  readonly clusterArn: string
  readonly serviceArn: string
  readonly taskDefinition: string
  readonly traceId: string
  readonly databaseSpanCount: number
  readonly healthStatus: number
  readonly profileStatus: number
}

const fail = (
  phase: VerificationPhase,
  summary: string
): Effect.Effect<never, ProductionVerificationError> =>
  Effect.fail(new ProductionVerificationError({ phase, summary }))

const decodeResources = (input: unknown) =>
  Schema.decodeUnknownEffect(TaggedResourceResponse)(input).pipe(
    Effect.mapError(
      () =>
        new ProductionVerificationError({
          phase: 'resource-discovery',
          summary: 'AWS returned an invalid tagged-resource response'
        })
    )
  )

const decodeEcsService = (input: unknown) =>
  Schema.decodeUnknownEffect(DescribeServicesResponse)(input).pipe(
    Effect.mapError(
      () =>
        new ProductionVerificationError({
          phase: 'ecs-rollout',
          summary: 'AWS returned an invalid ECS service response'
        })
    )
  )

const decodeTaskDefinition = (input: unknown) =>
  Schema.decodeUnknownEffect(DescribeTaskDefinitionResponse)(input).pipe(
    Effect.mapError(
      () =>
        new ProductionVerificationError({
          phase: 'ecs-rollout',
          summary: 'AWS returned an invalid ECS task-definition response'
        })
    )
  )

const decodeSentrySpans = (input: unknown, phase: 'sentry-ingestion' | 'sentry-privacy') =>
  Schema.decodeUnknownEffect(SentrySpansResponse)(input).pipe(
    Effect.mapError(
      () =>
        new ProductionVerificationError({
          phase,
          summary: 'Sentry returned an invalid spans response'
        })
    )
  )

const parseEcsResources = (
  input: unknown
): Effect.Effect<EcsResources, ProductionVerificationError> =>
  Effect.gen(function* () {
    const response = yield* decodeResources(input)
    const clusterArns = response.ResourceTagMappingList.flatMap(({ ResourceARN }) =>
      ResourceARN.includes(':cluster/') ? [ResourceARN] : []
    )
    const serviceArns = response.ResourceTagMappingList.flatMap(({ ResourceARN }) =>
      ResourceARN.includes(':service/') ? [ResourceARN] : []
    )

    if (clusterArns.length !== 1 || serviceArns.length !== 1) {
      return yield* fail(
        'resource-discovery',
        `Expected one production ECS cluster and service, found ${clusterArns.length} cluster(s) and ${serviceArns.length} service(s)`
      )
    }

    const clusterArn = clusterArns[0]
    const serviceArn = serviceArns[0]
    if (clusterArn === undefined || serviceArn === undefined) {
      return yield* fail('resource-discovery', 'AWS resource discovery returned no usable ARN')
    }

    const clusterName = clusterArn.split('/').at(-1)
    if (clusterName === undefined || !serviceArn.includes(`:service/${clusterName}/`)) {
      return yield* fail(
        'resource-discovery',
        'The discovered ECS service does not belong to the discovered cluster'
      )
    }

    return { clusterArn, serviceArn }
  })

const waitForStableEcsService = (
  resources: EcsResources,
  config: ProductionVerificationConfig['ecs']
): Effect.Effect<string, ProductionVerificationError, ProductionVerificationPort> =>
  Effect.gen(function* () {
    const port = yield* ProductionVerificationPort
    let lastState = 'unavailable'

    for (let attempt = 1; attempt <= config.attempts; attempt += 1) {
      const response = yield* port
        .describeEcsService(resources)
        .pipe(Effect.flatMap(decodeEcsService))

      if (response.failures.length > 0 || response.services.length !== 1) {
        return yield* fail(
          'ecs-rollout',
          'AWS did not return exactly one healthy ECS service result'
        )
      }

      const service = response.services[0]
      if (service === undefined) {
        return yield* fail('ecs-rollout', 'AWS returned no ECS service')
      }

      const deployment = service.deployments[0]
      const failedTasks = service.deployments.reduce(
        (count, candidate) => count + candidate.failedTasks,
        0
      )

      if (failedTasks > 0) {
        return yield* fail('ecs-rollout', `ECS rollout recorded ${failedTasks} failed task(s)`)
      }

      const isStable =
        service.desiredCount > 0 &&
        service.runningCount === service.desiredCount &&
        service.pendingCount === 0 &&
        service.deployments.length === 1 &&
        deployment?.status === 'PRIMARY' &&
        deployment.rolloutState === 'COMPLETED' &&
        deployment.runningCount === service.desiredCount &&
        deployment.pendingCount === 0

      if (isStable) return deployment.taskDefinition

      lastState = `desired=${service.desiredCount}, running=${service.runningCount}, pending=${service.pendingCount}, deployments=${service.deployments.length}, rollout=${deployment?.rolloutState ?? 'unknown'}`
      if (attempt < config.attempts) yield* port.wait(config.intervalMs)
    }

    return yield* fail(
      'ecs-rollout',
      `ECS did not reach steady state after ${config.attempts} attempts (${lastState})`
    )
  })

const verifyTaskDefinitionRelease = (
  taskDefinitionArn: string,
  release: string
): Effect.Effect<void, ProductionVerificationError, ProductionVerificationPort> =>
  Effect.gen(function* () {
    const port = yield* ProductionVerificationPort
    const response = yield* port
      .describeTaskDefinition(taskDefinitionArn)
      .pipe(Effect.flatMap(decodeTaskDefinition))
    const releases = response.taskDefinition.containerDefinitions.flatMap(({ environment }) =>
      environment.flatMap(({ name, value }) => (name === 'SENTRY_RELEASE' ? [value] : []))
    )

    if (releases.length !== 1 || releases[0] !== release) {
      return yield* fail(
        'ecs-rollout',
        'The stable ECS task definition does not contain the deployed Sentry release'
      )
    }
  })

const verifyHealthProbe = (
  baseUrl: URL
): Effect.Effect<number, ProductionVerificationError, ProductionVerificationPort> =>
  Effect.gen(function* () {
    const port = yield* ProductionVerificationPort
    const response = yield* port.probe({ url: new URL('/health', baseUrl) })

    if (response.status !== 200) {
      return yield* fail('health-probe', `Health probe returned HTTP ${response.status}`)
    }

    yield* Schema.decodeUnknownEffect(HealthReadyResponse)(response.body).pipe(
      Effect.mapError(
        () =>
          new ProductionVerificationError({
            phase: 'health-probe',
            summary: 'Health probe returned an invalid readiness response'
          })
      )
    )
    return response.status
  })

const verifyProfileProbe = (
  config: ProductionVerificationConfig
): Effect.Effect<number, ProductionVerificationError, ProductionVerificationPort> =>
  Effect.gen(function* () {
    const port = yield* ProductionVerificationPort
    const response = yield* port.probe({
      url: new URL(config.profilePath, config.baseUrl),
      traceparent: `00-${config.traceId}-${config.parentSpanId}-01`
    })

    if (response.status !== 200) {
      return yield* fail('profile-probe', `Profile probe returned HTTP ${response.status}`)
    }

    yield* Schema.decodeUnknownEffect(PublicProfileResponse)(response.body).pipe(
      Effect.mapError(
        () =>
          new ProductionVerificationError({
            phase: 'profile-probe',
            summary: 'Profile probe returned an invalid public-profile response'
          })
      )
    )
    return response.status
  })

const spanHasExpectedCorrelation = (
  span: typeof SentrySpan.Type,
  config: ProductionVerificationConfig
) =>
  span.parent_span !== null &&
  span['span.op'] === 'db.query' &&
  span.transaction === config.profileTransaction &&
  span.trace === config.traceId &&
  span.release === config.release &&
  span.environment === config.environment

const spanHasSafeDatabaseData = (span: typeof SentrySpan.Type) =>
  span['db.system.name'] === 'postgresql' &&
  span['gbfm.db.instrumentation'] === 'manual' &&
  span['db.operation.name'] !== null &&
  SAFE_DATABASE_OPERATION.test(span['db.operation.name']) &&
  span['db.collection.name'] !== null &&
  SAFE_DATABASE_COLLECTION.test(span['db.collection.name']) &&
  span['db.query.summary'] !== null &&
  SAFE_DATABASE_SUMMARY.test(span['db.query.summary']) &&
  (span.description === null || SAFE_DATABASE_SUMMARY.test(span.description)) &&
  span['db.statement'] === null &&
  span['db.query'] === null &&
  span['db.query.text'] === null

const validateDatabaseSpans = (
  spans: ReadonlyArray<typeof SentrySpan.Type>,
  config: ProductionVerificationConfig
): ProductionVerificationError | undefined => {
  if (!spans.every((span) => spanHasExpectedCorrelation(span, config))) {
    return new ProductionVerificationError({
      phase: 'sentry-correlation',
      summary: 'Sentry returned a database span with missing or mismatched trace correlation'
    })
  }
  if (!spans.every(spanHasSafeDatabaseData)) {
    return new ProductionVerificationError({
      phase: 'sentry-privacy',
      summary: 'Sentry returned an automatic or privacy-unsafe database span'
    })
  }
}

const databaseSpanFingerprint = (spans: ReadonlyArray<typeof SentrySpan.Type>) =>
  JSON.stringify(
    [...spans]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((span) => ({
        id: span.id,
        parentSpan: span.parent_span,
        operation: span['span.op'],
        description: span.description,
        transaction: span.transaction,
        trace: span.trace,
        release: span.release,
        environment: span.environment,
        databaseSystem: span['db.system.name'],
        databaseOperation: span['db.operation.name'],
        databaseCollection: span['db.collection.name'],
        databaseSummary: span['db.query.summary'],
        instrumentation: span['gbfm.db.instrumentation'],
        statement: span['db.statement'],
        query: span['db.query'],
        queryText: span['db.query.text']
      }))
  )

const queryDatabaseSpans = (
  config: ProductionVerificationConfig,
  phase: 'sentry-ingestion' | 'sentry-privacy'
): Effect.Effect<
  ReadonlyArray<typeof SentrySpan.Type>,
  ProductionVerificationError,
  ProductionVerificationPort
> =>
  Effect.gen(function* () {
    const port = yield* ProductionVerificationPort
    const response = yield* port
      .querySpans({
        environment: config.environment,
        operation: 'db.query',
        release: config.release,
        traceId: config.traceId
      })
      .pipe(Effect.flatMap((input) => decodeSentrySpans(input, phase)))
    return response.data
  })

const waitForDatabaseSpans = (
  config: ProductionVerificationConfig
): Effect.Effect<void, ProductionVerificationError, ProductionVerificationPort> =>
  Effect.gen(function* () {
    const port = yield* ProductionVerificationPort

    for (let attempt = 1; attempt <= config.sentry.attempts; attempt += 1) {
      const spans = yield* queryDatabaseSpans(config, 'sentry-ingestion')

      if (spans.length > 0) return

      if (attempt < config.sentry.attempts) yield* port.wait(config.sentry.intervalMs)
    }

    return yield* fail(
      'sentry-ingestion',
      `No database spans arrived for the verification trace after ${config.sentry.attempts} attempts`
    )
  })

const verifySettledDatabaseSpans = (
  config: ProductionVerificationConfig
): Effect.Effect<number, ProductionVerificationError, ProductionVerificationPort> =>
  Effect.gen(function* () {
    const port = yield* ProductionVerificationPort
    let stablePolls = 0
    let previousFingerprint: string | undefined
    let lastViolation: ProductionVerificationError | undefined

    for (let attempt = 1; attempt <= config.sentry.attempts; attempt += 1) {
      const spans = yield* queryDatabaseSpans(config, 'sentry-privacy')
      const violation =
        spans.length === 0
          ? new ProductionVerificationError({
              phase: 'sentry-ingestion',
              summary: 'Database spans disappeared during Sentry ingestion settlement'
            })
          : validateDatabaseSpans(spans, config)

      if (violation === undefined) {
        const fingerprint = databaseSpanFingerprint(spans)
        stablePolls = fingerprint === previousFingerprint ? stablePolls + 1 : 1
        previousFingerprint = fingerprint
        lastViolation = undefined
        if (stablePolls >= REQUIRED_STABLE_SENTRY_POLLS) return spans.length
      } else {
        stablePolls = 0
        previousFingerprint = undefined
        lastViolation = violation
      }

      if (attempt < config.sentry.attempts) yield* port.wait(config.sentry.intervalMs)
    }

    if (lastViolation !== undefined) return yield* Effect.fail(lastViolation)
    return yield* fail(
      'sentry-ingestion',
      `Database spans did not converge after ${config.sentry.attempts} settlement attempts`
    )
  })

const verifyNoAutomaticDatabaseSpans = (
  config: ProductionVerificationConfig
): Effect.Effect<void, ProductionVerificationError, ProductionVerificationPort> =>
  Effect.gen(function* () {
    const port = yield* ProductionVerificationPort
    const response = yield* port
      .querySpans({
        environment: config.environment,
        operation: 'db',
        release: config.release,
        traceId: config.traceId
      })
      .pipe(Effect.flatMap((input) => decodeSentrySpans(input, 'sentry-privacy')))

    if (response.data.length > 0) {
      return yield* fail(
        'sentry-privacy',
        `Sentry returned ${response.data.length} forbidden automatic database span(s)`
      )
    }
  })

/**
 * Verifies ECS steady state, functional production routes, and trace-specific
 * Sentry database telemetry and privacy invariants.
 */
export const verifyProductionDeployment = (
  config: ProductionVerificationConfig
): Effect.Effect<
  ProductionVerificationReport,
  ProductionVerificationError,
  ProductionVerificationPort
> =>
  Effect.gen(function* () {
    const port = yield* ProductionVerificationPort
    const resources = yield* port
      .discoverEcsResources(config.app, config.stage)
      .pipe(Effect.flatMap(parseEcsResources))
    const taskDefinition = yield* waitForStableEcsService(resources, config.ecs)
    yield* verifyTaskDefinitionRelease(taskDefinition, config.release)
    const healthStatus = yield* verifyHealthProbe(config.baseUrl)
    const profileStatus = yield* verifyProfileProbe(config)
    yield* waitForDatabaseSpans(config)
    const databaseSpanCount = yield* verifySettledDatabaseSpans(config)
    yield* verifyNoAutomaticDatabaseSpans(config)

    return {
      release: config.release,
      clusterArn: resources.clusterArn,
      serviceArn: resources.serviceArn,
      taskDefinition,
      traceId: config.traceId,
      databaseSpanCount,
      healthStatus,
      profileStatus
    }
  })
