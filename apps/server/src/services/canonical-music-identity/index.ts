import { Context, Effect, Fiber, Layer } from 'effect'
import { Database } from '@/db/layer'
import {
  MusicLinkScraperService,
  type MusicScraperError,
  type ScrapeResult
} from '@/services/music-link-scraper.service'
import type {
  CanonicalMusicIdentityService,
  ImportProviderMusicEntity,
  ResolveMusicSource,
  ResolvedMusicEntity
} from './contract'
import { makeEntityOperations } from './entity-operations'
import { loadEntity, prepareEntityRecord, slugFor } from './entity-record'
import {
  MusicIdentityBusy,
  MusicIdentityConflict,
  type MusicIdentityError,
  MusicIdentityInvalidSnapshot,
  MusicIdentityProviderRejected,
  MusicIdentityProviderUnavailable,
  MusicIdentityStorageError
} from './errors'
import {
  type CanonicalMusicEntityType,
  parseMusicSource,
  type ParsedMusicSource
} from './music-source'
import {
  asResolvedReference,
  CanonicalMusicIdentityRepository,
  type EntityReference
} from './repository'
import {
  hasUsableResult,
  inferredType,
  parseDiscoveredSources,
  type ProviderMusicSnapshot,
  snapshotResult,
  uniqueLinks
} from './source-result'

export type {
  AttachMusicSourceLink,
  CanonicalMusicIdentityService,
  ImportProviderMusicEntity,
  RefreshedMusicEntity,
  RefreshMusicEntity,
  ResolutionOrigin,
  ResolvedMusicEntity,
  ResolveMusicSource
} from './contract'
export type { ResolvedEntity } from './entity-record'
export type { ProviderMusicLink, ProviderMusicSnapshot } from './source-result'

export const CanonicalMusicIdentity =
  Context.Service<CanonicalMusicIdentityService>('CanonicalMusicIdentity')

export type CanonicalMusicIdentityLeaseTimingConfig = {
  readonly leaseMs: number
  readonly waitAttempts: number
  readonly waitMs: number
}

export const CanonicalMusicIdentityLeaseTiming =
  Context.Reference<CanonicalMusicIdentityLeaseTimingConfig>('CanonicalMusicIdentityLeaseTiming', {
    defaultValue: () => ({ leaseMs: 30_000, waitAttempts: 40, waitMs: 25 })
  })

const providerError = (error: MusicScraperError): MusicIdentityError => {
  if (error.statusCode === 400) {
    return new MusicIdentityProviderRejected({
      provider: error.provider,
      reason: 'invalid_request',
      message: error.message
    })
  }
  if (error.statusCode === 404) {
    return new MusicIdentityProviderRejected({
      provider: error.provider,
      reason: 'not_found',
      message: error.message
    })
  }
  if (error.statusCode === undefined) {
    return new MusicIdentityProviderUnavailable({
      provider: error.provider,
      message: error.message
    })
  }
  return new MusicIdentityProviderUnavailable({
    provider: error.provider,
    statusCode: error.statusCode,
    message: error.message
  })
}

const storageError = (operation: string, message: string) =>
  new MusicIdentityStorageError({ operation, message })

const referenceKey = (reference: EntityReference) => `${reference.entityType}:${reference.entityId}`

const legacyFallbackType = (source: ParsedMusicSource, expectedType?: CanonicalMusicEntityType) => {
  if (expectedType) return expectedType
  const type = source.sourceEntityType
  return type === 'artist' || type === 'album' || type === 'track' || type === 'playlist'
    ? type
    : undefined
}

const resolvedResult = (
  repository: CanonicalMusicIdentityRepository,
  reference: EntityReference,
  created: boolean
) =>
  Effect.gen(function* () {
    const entity = yield* loadEntity(reference)
    const links = yield* repository.linksFor(reference)
    return { entity, links, created } satisfies ResolvedMusicEntity
  })

export const CanonicalMusicIdentityLayer = Layer.effect(
  CanonicalMusicIdentity,
  Effect.gen(function* () {
    const db = yield* Database
    const scraper = yield* MusicLinkScraperService
    const leaseTiming = yield* CanonicalMusicIdentityLeaseTiming
    const heartbeatMs = Math.max(1, Math.floor(leaseTiming.leaseMs / 3))
    const repository = new CanonicalMusicIdentityRepository(db)
    const provideDb = Effect.provideService(Database, db)

    const readReference = (source: ParsedMusicSource) =>
      Effect.gen(function* () {
        const identity = yield* repository.lookup(source)
        if (!identity) return undefined
        const reference = asResolvedReference(identity)
        if (!reference) return undefined
        const entity = yield* loadEntity(reference).pipe(
          provideDb,
          Effect.catchTag('MusicIdentityEntityNotFound', () => Effect.succeed(undefined))
        )
        if (entity) {
          yield* repository.touchAlias(source, reference, new Date())
          return reference
        }
        yield* repository.removeOrphan(reference)
        return undefined
      }).pipe(
        Effect.withSpan('musicIdentity.lookup', {
          attributes: {
            platform: source.platform,
            sourceEntityType: source.sourceEntityType
          }
        })
      )

    const findLegacyReference = (source: ParsedMusicSource, entityType: CanonicalMusicEntityType) =>
      Effect.gen(function* () {
        const candidates = yield* repository.legacyCandidates(source, entityType)
        for (const candidate of candidates) {
          const parsed = yield* parseMusicSource(candidate.url, entityType).pipe(
            Effect.catchTag('MusicSourceInvalid', () => Effect.succeed(undefined))
          )
          if (!parsed || parsed.sourceKey !== source.sourceKey) continue
          const reference = { entityType, entityId: candidate.entityId }
          const entity = yield* loadEntity(reference).pipe(
            provideDb,
            Effect.catchTag('MusicIdentityEntityNotFound', () => Effect.succeed(undefined))
          )
          if (entity) return reference
        }
        return undefined
      })

    const claimWithWait = (
      source: ParsedMusicSource,
      ownerToken: string,
      attempt = 0
    ): Effect.Effect<EntityReference | 'owned', MusicIdentityError> =>
      Effect.gen(function* () {
        const claim = yield* repository
          .claim(source, ownerToken, new Date(), leaseTiming.leaseMs)
          .pipe(
            Effect.withSpan('musicIdentity.claim', {
              attributes: {
                platform: source.platform,
                sourceEntityType: source.sourceEntityType
              }
            })
          )
        if (claim._tag === 'owned') return 'owned' as const
        if (claim._tag === 'resolved') return claim.reference
        if (attempt >= leaseTiming.waitAttempts) {
          return yield* new MusicIdentityBusy({ retryAfterMs: claim.retryAfterMs })
        }
        yield* Effect.sleep(`${leaseTiming.waitMs} millis`)
        const reference = yield* readReference(source)
        if (reference) return reference
        return yield* claimWithWait(source, ownerToken, attempt + 1)
      })

    const waitForResolved = (
      source: ParsedMusicSource,
      attempt = 0
    ): Effect.Effect<EntityReference, MusicIdentityError> =>
      Effect.gen(function* () {
        const reference = yield* readReference(source)
        if (reference) return reference
        if (attempt >= leaseTiming.waitAttempts) {
          return yield* new MusicIdentityBusy({ retryAfterMs: leaseTiming.leaseMs })
        }
        yield* Effect.sleep(`${leaseTiming.waitMs} millis`)
        return yield* waitForResolved(source, attempt + 1)
      })

    const adoptLegacy = (
      source: ParsedMusicSource,
      entityType: CanonicalMusicEntityType
    ): Effect.Effect<ResolvedMusicEntity | undefined, MusicIdentityError> =>
      Effect.gen(function* () {
        const legacy = yield* findLegacyReference(source, entityType)
        if (!legacy) return undefined
        const ownerToken = crypto.randomUUID()
        const claim = yield* claimWithWait(source, ownerToken)
        if (claim !== 'owned') {
          return yield* resolvedResult(repository, claim, false).pipe(provideDb)
        }
        const adopted = yield* repository.commit({
          ownedSources: [source],
          allSources: [source],
          reference: legacy,
          links: [],
          ownerToken,
          scrapedAt: new Date(),
          now: new Date()
        })
        if (adopted) return yield* resolvedResult(repository, legacy, false).pipe(provideDb)
        yield* repository.release([source.sourceKey], ownerToken)
        const winner = yield* readReference(source)
        if (winner) return yield* resolvedResult(repository, winner, false).pipe(provideDb)
        return yield* new MusicIdentityBusy({ retryAfterMs: leaseTiming.leaseMs })
      })

    const withClaimHeartbeat = <A>(
      ownedSources: readonly ParsedMusicSource[],
      ownerToken: string,
      effect: Effect.Effect<A, MusicIdentityError>
    ): Effect.Effect<A, MusicIdentityError> =>
      Effect.scoped(
        Effect.gen(function* () {
          const heartbeat = Effect.gen(function* () {
            yield* Effect.sleep(`${heartbeatMs} millis`)
            const sourceKeys = ownedSources.map((source) => source.sourceKey)
            const renewed = yield* repository.renew(
              sourceKeys,
              ownerToken,
              new Date(),
              leaseTiming.leaseMs
            )
            if (renewed.length !== sourceKeys.length) {
              return yield* new MusicIdentityBusy({ retryAfterMs: leaseTiming.leaseMs })
            }
            return undefined
          }).pipe(Effect.forever)
          const heartbeatFiber = yield* Effect.forkScoped(heartbeat)
          return yield* Effect.raceFirst(effect, Fiber.join(heartbeatFiber))
        })
      )

    const resolvePrepared = (
      initial: ParsedMusicSource,
      resultEffect: Effect.Effect<ScrapeResult, MusicIdentityError>,
      entityDetails?: {
        readonly description?: string
        readonly trackNumber?: number
        readonly curatorId?: string | null
      },
      fallbackType?: CanonicalMusicEntityType
    ): Effect.Effect<ResolvedMusicEntity, MusicIdentityError> =>
      Effect.gen(function* () {
        const hit = yield* readReference(initial)
        if (hit) return yield* resolvedResult(repository, hit, false).pipe(provideDb)
        if (fallbackType) {
          const adopted = yield* adoptLegacy(initial, fallbackType)
          if (adopted) return adopted
        }

        const ownerToken = crypto.randomUUID()
        const firstClaim = yield* claimWithWait(initial, ownerToken)
        if (firstClaim !== 'owned') {
          return yield* resolvedResult(repository, firstClaim, false).pipe(provideDb)
        }

        const ownedSources: ParsedMusicSource[] = [initial]
        return yield* Effect.gen(function* () {
          const result = yield* withClaimHeartbeat(ownedSources, ownerToken, resultEffect)
          if (!hasUsableResult(result)) {
            return yield* new MusicIdentityInvalidSnapshot({
              message: 'Music source resolution returned no metadata or links'
            })
          }
          const entityType = inferredType(initial, result)
          if (!entityType) {
            return yield* new MusicIdentityInvalidSnapshot({
              message: 'Music entity type could not be inferred'
            })
          }
          const scrapedAt = new Date()
          const links = uniqueLinks(initial, result, scrapedAt)
          const sources = yield* parseDiscoveredSources(initial, links, entityType)
          const incumbents = new Map<string, EntityReference>()

          for (const source of sources) {
            if (source.sourceKey === initial.sourceKey) continue
            const existing = yield* readReference(source)
            if (existing) {
              incumbents.set(referenceKey(existing), existing)
              continue
            }
            const attempted = yield* repository.claim(
              source,
              ownerToken,
              new Date(),
              leaseTiming.leaseMs
            )
            if (attempted._tag === 'owned') {
              ownedSources.push(source)
              continue
            }
            if (attempted._tag === 'resolved') {
              incumbents.set(referenceKey(attempted.reference), attempted.reference)
              continue
            }
            if (source.sourceKey < initial.sourceKey) {
              yield* repository.release(
                ownedSources.map((owned) => owned.sourceKey),
                ownerToken
              )
              const winner = yield* waitForResolved(initial)
              return yield* resolvedResult(repository, winner, false).pipe(provideDb)
            }
            const claim = yield* claimWithWait(source, ownerToken)
            if (claim === 'owned') ownedSources.push(source)
            else incumbents.set(referenceKey(claim), claim)
          }

          if (incumbents.size > 1) {
            const values = [...incumbents.values()]
            const incumbent = values[0]
            const candidate = values[1]
            if (!incumbent || !candidate) {
              return yield* storageError('collision', 'Identity collision references are missing')
            }
            let conflictSourceKey = initial.sourceKey
            for (const source of sources) {
              const identity = yield* repository.lookup(source)
              const reference = identity ? asResolvedReference(identity) : undefined
              if (reference && referenceKey(reference) === referenceKey(candidate)) {
                conflictSourceKey = source.sourceKey
                break
              }
            }
            yield* repository.recordConflict(
              conflictSourceKey,
              incumbent,
              candidate,
              'discovered_sources_disagree',
              new Date()
            )
            return yield* new MusicIdentityConflict({
              sourceKey: conflictSourceKey,
              incumbentEntityType: incumbent.entityType,
              incumbentEntityId: incumbent.entityId,
              candidateEntityType: candidate.entityType,
              candidateEntityId: candidate.entityId
            })
          }

          const incumbent = [...incumbents.values()][0]
          const reference: EntityReference = incumbent ?? {
            entityType,
            entityId: crypto.randomUUID()
          }
          const entity = incumbent
            ? undefined
            : yield* prepareEntityRecord(db, entityType, reference.entityId, result, entityDetails)
          const slug = entity
            ? yield* Effect.tryPromise({
                try: () => slugFor(db, entity),
                catch: (cause) =>
                  storageError(
                    'slug',
                    cause instanceof Error ? cause.message : 'Slug lookup failed'
                  )
              })
            : undefined
          const renewed = yield* repository.renew(
            ownedSources.map((source) => source.sourceKey),
            ownerToken,
            new Date(),
            leaseTiming.leaseMs
          )
          if (renewed.length !== ownedSources.length) {
            return yield* new MusicIdentityBusy({ retryAfterMs: leaseTiming.leaseMs })
          }
          const committed = yield* repository
            .commit({
              ownedSources,
              allSources: sources,
              reference,
              entity,
              slug,
              links,
              ownerToken,
              scrapedAt,
              now: new Date()
            })
            .pipe(Effect.withSpan('musicIdentity.commit'))
          if (!committed) {
            const winner = yield* readReference(initial)
            if (winner) return yield* resolvedResult(repository, winner, false).pipe(provideDb)
            return yield* new MusicIdentityBusy({ retryAfterMs: leaseTiming.leaseMs })
          }
          return yield* resolvedResult(repository, reference, !incumbent).pipe(provideDb)
        }).pipe(
          Effect.tapError(() =>
            repository.release(
              ownedSources.map((source) => source.sourceKey),
              ownerToken
            )
          )
        )
      })

    const resolveSource = (input: ResolveMusicSource) =>
      Effect.gen(function* () {
        const source = yield* parseMusicSource(input.url, input.expectedType)
        return yield* resolvePrepared(
          source,
          Effect.suspend(() =>
            scraper.scrape({ url: source.canonicalUrl, entityType: input.expectedType }).pipe(
              Effect.mapError(providerError),
              Effect.withSpan('musicIdentity.scrape', {
                attributes: { platform: source.platform }
              })
            )
          ),
          undefined,
          legacyFallbackType(source, input.expectedType)
        )
      }).pipe(
        Effect.withSpan('musicIdentity.resolveSource', {
          attributes: { origin: input.origin, expectedType: input.expectedType }
        })
      )

    const importProviderEntity = (input: ImportProviderMusicEntity) =>
      Effect.gen(function* () {
        if (!input.snapshot.title.trim()) {
          return yield* new MusicIdentityInvalidSnapshot({ message: 'Snapshot title is required' })
        }
        const source = yield* parseMusicSource(input.snapshot.sourceUrl, input.snapshot.entityType)
        return yield* resolvePrepared(
          source,
          Effect.succeed(snapshotResult(input.snapshot, source)),
          input.snapshot,
          input.snapshot.entityType
        )
      }).pipe(
        Effect.withSpan('musicIdentity.importProviderEntity', {
          attributes: { origin: input.origin, entityType: input.snapshot.entityType }
        })
      )

    const { attachLink, refreshEntity } = makeEntityOperations(
      db,
      scraper,
      repository,
      readReference,
      claimWithWait,
      providerError,
      leaseTiming.leaseMs
    )

    return {
      resolveSource,
      importProviderEntity,
      attachLink,
      refreshEntity
    } satisfies CanonicalMusicIdentityService
  })
)
