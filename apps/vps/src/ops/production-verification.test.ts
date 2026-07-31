import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  ProductionVerificationPort,
  type ProductionVerificationConfig,
  type ProductionVerificationPort as ProductionVerificationPortShape,
  verifyProductionDeployment
} from './production-verification'

const traceId = '1'.repeat(32)
const parentSpanId = '2'.repeat(16)

const config: ProductionVerificationConfig = {
  app: 'gbfm',
  stage: 'prod',
  environment: 'production',
  release: 'v2.76.7',
  baseUrl: new URL('https://vps.goosebumps.fm'),
  profilePath: '/api/profile/guidefari',
  traceId,
  parentSpanId,
  ecs: { attempts: 2, intervalMs: 1 },
  sentry: { attempts: 2, intervalMs: 1 }
}

const resources = {
  ResourceTagMappingList: [
    {
      ResourceARN: 'arn:aws:ecs:us-east-1:123:cluster/gbfm-prod-cluster'
    },
    {
      ResourceARN: 'arn:aws:ecs:us-east-1:123:service/gbfm-prod-cluster/gbfm_vps'
    }
  ]
}

const ecsService = (rolloutState: 'IN_PROGRESS' | 'COMPLETED' = 'COMPLETED') => ({
  services: [
    {
      clusterArn: resources.ResourceTagMappingList[0]?.ResourceARN,
      serviceArn: resources.ResourceTagMappingList[1]?.ResourceARN,
      desiredCount: 1,
      runningCount: rolloutState === 'COMPLETED' ? 1 : 2,
      pendingCount: 0,
      deployments:
        rolloutState === 'COMPLETED'
          ? [
              {
                status: 'PRIMARY',
                rolloutState,
                runningCount: 1,
                pendingCount: 0,
                failedTasks: 0,
                taskDefinition: 'arn:aws:ecs:us-east-1:123:task-definition/gbfm_vps:202'
              }
            ]
          : [
              {
                status: 'PRIMARY',
                rolloutState,
                runningCount: 1,
                pendingCount: 0,
                failedTasks: 0,
                taskDefinition: 'arn:aws:ecs:us-east-1:123:task-definition/gbfm_vps:202'
              },
              {
                status: 'ACTIVE',
                rolloutState: 'COMPLETED',
                runningCount: 1,
                pendingCount: 0,
                failedTasks: 0,
                taskDefinition: 'arn:aws:ecs:us-east-1:123:task-definition/gbfm_vps:201'
              }
            ]
    }
  ],
  failures: []
})

const profile = {
  id: 'profile-1',
  name: 'Guide Fari',
  username: 'guidefari',
  image: null,
  bio: null,
  socialLinks: [],
  createdAt: '2026-07-31T00:00:00.000Z',
  content: {
    mixes: [],
    shows: [],
    editorials: [],
    tweets: []
  }
}

const databaseSpan = {
  id: 'span-1',
  parent_span: 'parent-span',
  'span.op': 'db.query',
  description: null,
  transaction: 'GET /api/profile/:username',
  trace: traceId,
  release: config.release,
  environment: config.environment,
  'db.system.name': 'postgresql',
  'db.operation.name': 'SELECT',
  'db.collection.name': 'user',
  'db.query.summary': 'SELECT user',
  'db.statement': null,
  'db.query': null,
  'db.query.text': null
}

type TestOverrides = {
  readonly ecsResponses?: ReadonlyArray<unknown>
  readonly expectedSpanResponses?: ReadonlyArray<unknown>
  readonly forbiddenSpanResponse?: unknown
}

const makeTestLayer = (overrides: TestOverrides = {}) => {
  const ecsResponses = [...(overrides.ecsResponses ?? [ecsService()])]
  const expectedSpanResponses = [...(overrides.expectedSpanResponses ?? [{ data: [databaseSpan] }])]
  const probes: Array<{ readonly url: string; readonly traceparent?: string }> = []
  let waits = 0

  const take = (values: Array<unknown>, fallback: unknown) => values.shift() ?? fallback

  const port: ProductionVerificationPortShape = {
    discoverEcsResources: () => Effect.succeed(resources),
    describeEcsService: () => Effect.succeed(take(ecsResponses, ecsService())),
    probe: ({ traceparent, url }) => {
      probes.push({ url: url.toString(), traceparent })
      return Effect.succeed({
        status: 200,
        body: url.pathname === '/health' ? { dbConnected: true } : profile
      })
    },
    querySpans: ({ operation }) =>
      Effect.succeed(
        operation === 'db.query'
          ? take(expectedSpanResponses, { data: [] })
          : (overrides.forbiddenSpanResponse ?? { data: [] })
      ),
    wait: () =>
      Effect.sync(() => {
        waits += 1
      })
  }

  return {
    layer: Layer.succeed(ProductionVerificationPort, port),
    probes,
    waitCount: () => waits
  }
}

describe('verifyProductionDeployment', () => {
  test('waits for ECS and proves functional, correlated, privacy-safe telemetry', async () => {
    const testLayer = makeTestLayer({
      ecsResponses: [ecsService('IN_PROGRESS'), ecsService()],
      expectedSpanResponses: [{ data: [] }, { data: [databaseSpan] }]
    })

    const report = await Effect.runPromise(
      verifyProductionDeployment(config).pipe(Effect.provide(testLayer.layer))
    )

    expect(report).toEqual({
      release: config.release,
      clusterArn: resources.ResourceTagMappingList[0]?.ResourceARN,
      serviceArn: resources.ResourceTagMappingList[1]?.ResourceARN,
      taskDefinition: 'arn:aws:ecs:us-east-1:123:task-definition/gbfm_vps:202',
      traceId,
      databaseSpanCount: 1,
      healthStatus: 200,
      profileStatus: 200
    })
    expect(testLayer.probes).toEqual([
      { url: 'https://vps.goosebumps.fm/health', traceparent: undefined },
      {
        url: 'https://vps.goosebumps.fm/api/profile/guidefari',
        traceparent: `00-${traceId}-${parentSpanId}-01`
      }
    ])
    expect(testLayer.waitCount()).toBe(3)
  })

  test('fails when ECS never reaches a single completed deployment', async () => {
    const testLayer = makeTestLayer({
      ecsResponses: [ecsService('IN_PROGRESS'), ecsService('IN_PROGRESS')]
    })

    await expect(
      Effect.runPromise(verifyProductionDeployment(config).pipe(Effect.provide(testLayer.layer)))
    ).rejects.toMatchObject({
      phase: 'ecs-rollout',
      summary: expect.stringContaining('did not reach steady state')
    })
  })

  test('fails safely when AWS returns a malformed service boundary', async () => {
    const testLayer = makeTestLayer({
      ecsResponses: [{ services: 'not-an-array', failures: [] }]
    })

    await expect(
      Effect.runPromise(verifyProductionDeployment(config).pipe(Effect.provide(testLayer.layer)))
    ).rejects.toMatchObject({
      phase: 'ecs-rollout',
      summary: 'AWS returned an invalid ECS service response'
    })
  })

  test('fails when the verification trace never reaches Sentry', async () => {
    const testLayer = makeTestLayer({
      expectedSpanResponses: [{ data: [] }, { data: [] }]
    })

    await expect(
      Effect.runPromise(verifyProductionDeployment(config).pipe(Effect.provide(testLayer.layer)))
    ).rejects.toMatchObject({
      phase: 'sentry-ingestion',
      summary: expect.stringContaining('No database spans arrived')
    })
  })

  test('fails safely when Sentry returns a malformed span boundary', async () => {
    const testLayer = makeTestLayer({
      expectedSpanResponses: [{ data: [{ id: 'incomplete-span' }] }]
    })

    await expect(
      Effect.runPromise(verifyProductionDeployment(config).pipe(Effect.provide(testLayer.layer)))
    ).rejects.toMatchObject({
      phase: 'sentry-ingestion',
      summary: 'Sentry returned an invalid spans response'
    })
  })

  test.each([
    {
      name: 'missing parent correlation',
      span: { ...databaseSpan, parent_span: null }
    },
    {
      name: 'raw SQL attribute',
      span: {
        ...databaseSpan,
        'db.statement': 'select * from user where id = $1'
      }
    },
    {
      name: 'wrong release',
      span: { ...databaseSpan, release: 'v-old' }
    },
    {
      name: 'SQL-shaped description',
      span: { ...databaseSpan, description: 'select * from user where id = $1' }
    }
  ])('fails privacy and correlation for $name', async ({ span }) => {
    const testLayer = makeTestLayer({
      expectedSpanResponses: [{ data: [span] }]
    })

    await expect(
      Effect.runPromise(verifyProductionDeployment(config).pipe(Effect.provide(testLayer.layer)))
    ).rejects.toMatchObject({
      phase: 'sentry-privacy',
      summary: expect.stringContaining('unsafe database span')
    })
  })

  test('fails when Sentry emits an automatic database span', async () => {
    const testLayer = makeTestLayer({
      forbiddenSpanResponse: {
        data: [{ ...databaseSpan, 'span.op': 'db' }]
      }
    })

    await expect(
      Effect.runPromise(verifyProductionDeployment(config).pipe(Effect.provide(testLayer.layer)))
    ).rejects.toMatchObject({
      phase: 'sentry-privacy',
      summary: expect.stringContaining('forbidden automatic database span')
    })
  })
})
