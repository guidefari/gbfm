import { Effect } from 'effect'
import type { DatabaseClient } from '@/db/layer'
import { Database } from '@/db/layer'
import type { SelectMusicEntityLink } from '@/db/music-entity.schema'
import type {
  MusicLinkScraperService,
  MusicScraperError,
  ScrapedLink
} from '@/services/music-link-scraper.service'
import type {
  AttachMusicSourceLink,
  RefreshMusicEntity,
  RefreshedMusicEntity,
  ReleaseMusicSourceLink
} from './contract'
import {
  MusicIdentityBusy,
  MusicIdentityConflict,
  type MusicIdentityError,
  MusicIdentityInvalidSnapshot,
  type MusicIdentityProviderRejected,
  type MusicIdentityProviderUnavailable,
  MusicIdentitySourceLinkNotFound,
  MusicIdentityStorageError,
  MusicSourceInvalid
} from './errors'
import { loadEntity, refreshedEntityRecord } from './entity-record'
import { parseMusicSource, type ParsedMusicSource } from './music-source'
import { CanonicalMusicIdentityRepository, type EntityReference } from './repository'
import { parseDiscoveredSources, uniqueLinks } from './source-result'
import { annotateEntity, annotateSource, withSafeTypedSpan } from './telemetry'

type ReadReference = (
  source: ParsedMusicSource
) => Effect.Effect<EntityReference | undefined, MusicIdentityError>

type ClaimWithWait = (
  source: ParsedMusicSource,
  ownerToken: string
) => Effect.Effect<EntityReference | 'owned', MusicIdentityError>

const referenceKey = (reference: EntityReference) => `${reference.entityType}:${reference.entityId}`

const storageError = (operation: string, message: string) =>
  new MusicIdentityStorageError({ operation, message })

type RefreshMode = 'automatic_enrichment' | 'administrator_refresh'

const compareOptionalDate = (left: Date | null, right: Date | null) => {
  if (left === null) return right === null ? 0 : 1
  if (right === null) return -1
  return left.getTime() - right.getTime()
}

const compareRefreshSourcePrecedence = (
  left: SelectMusicEntityLink,
  right: SelectMusicEntityLink
) =>
  compareOptionalDate(left.verifiedAt, right.verifiedAt) ||
  compareOptionalDate(left.scrapedAt, right.scrapedAt) ||
  left.createdAt.getTime() - right.createdAt.getTime() ||
  left.id.localeCompare(right.id)

export const makeEntityOperations = (
  db: DatabaseClient,
  scraper: MusicLinkScraperService,
  repository: CanonicalMusicIdentityRepository,
  readReference: ReadReference,
  claimWithWait: ClaimWithWait,
  providerError: (
    error: MusicScraperError
  ) => MusicIdentityProviderRejected | MusicIdentityProviderUnavailable,
  claimLeaseMs: number
) => {
  const provideDb = Effect.provideService(Database, db)

  const attachLink = (input: AttachMusicSourceLink) =>
    Effect.gen(function* () {
      const reference = { entityType: input.entityType, entityId: input.entityId }
      yield* annotateEntity(reference)
      yield* loadEntity(reference).pipe(provideDb)
      const source = yield* parseMusicSource(input.url, input.entityType)
      yield* annotateSource(source)
      if (source.platform !== input.platform) {
        return yield* new MusicSourceInvalid({
          reason: 'platform_mismatch',
          message: 'Music source platform does not match the requested platform'
        })
      }
      const existing = yield* readReference(source)
      if (existing && referenceKey(existing) !== referenceKey(reference)) {
        yield* repository.recordConflict(
          source.sourceKey,
          existing,
          reference,
          'manual_attachment_owned',
          new Date()
        )
        return yield* new MusicIdentityConflict({
          sourceKey: source.sourceKey,
          incumbentEntityType: existing.entityType,
          incumbentEntityId: existing.entityId,
          candidateEntityType: reference.entityType,
          candidateEntityId: reference.entityId
        })
      }
      if (existing) {
        const now = new Date()
        yield* repository.touchAlias(source, reference, now)
        const rows = yield* repository.upsertLink(
          reference,
          {
            platform: source.platform,
            url: source.canonicalUrl,
            scrapedAt: now,
            metadata: { discoveredBy: 'manual', confidence: 'exact_source' }
          },
          now
        )
        const link = rows[0]
        if (!link) {
          yield* loadEntity(reference).pipe(provideDb)
          return yield* storageError('attachLink', 'Attached link was not persisted')
        }
        return link
      }

      const ownerToken = crypto.randomUUID()
      const claim = yield* claimWithWait(source, ownerToken)
      if (claim !== 'owned') {
        if (referenceKey(claim) !== referenceKey(reference)) {
          yield* repository.recordConflict(
            source.sourceKey,
            claim,
            reference,
            'manual_attachment_owned',
            new Date()
          )
          return yield* new MusicIdentityConflict({
            sourceKey: source.sourceKey,
            incumbentEntityType: claim.entityType,
            incumbentEntityId: claim.entityId,
            candidateEntityType: reference.entityType,
            candidateEntityId: reference.entityId
          })
        }
      } else {
        const scrapedAt = new Date()
        const link: ScrapedLink = {
          platform: source.platform,
          url: source.canonicalUrl,
          scrapedAt,
          metadata: { discoveredBy: 'manual', confidence: 'exact_source' }
        }
        const committed = yield* repository
          .commit({
            ownedSources: [source],
            allSources: [source],
            reference,
            links: [link],
            ownerToken,
            scrapedAt,
            now: new Date()
          })
          .pipe(
            Effect.tapError(() => repository.release([source.sourceKey], ownerToken)),
            Effect.tap((didCommit) =>
              Effect.gen(function* () {
                yield* annotateSource(source)
                yield* annotateEntity(reference)
                yield* Effect.annotateCurrentSpan({
                  outcome: didCommit ? 'success' : 'lost_claim',
                  linkCount: 1,
                  aliasCount: 1
                })
              })
            ),
            withSafeTypedSpan('musicIdentity.commit')
          )
        if (!committed) {
          yield* repository.release([source.sourceKey], ownerToken)
          yield* loadEntity(reference).pipe(provideDb)
          return yield* new MusicIdentityBusy({ retryAfterMs: claimLeaseMs })
        }
      }
      const links = yield* repository.linksFor(reference)
      const attached = links.find((candidate) => candidate.platform === source.platform)
      if (attached) return attached
      const now = new Date()
      const rows = yield* repository.upsertLink(
        reference,
        {
          platform: source.platform,
          url: source.canonicalUrl,
          scrapedAt: now,
          metadata: { discoveredBy: 'manual', confidence: 'exact_source' }
        },
        now
      )
      const link = rows[0]
      if (!link) {
        yield* loadEntity(reference).pipe(provideDb)
        return yield* storageError('attachLink', 'Attached link was not persisted')
      }
      return link
    }).pipe(
      Effect.tap(() =>
        Effect.annotateCurrentSpan({
          origin: input.origin,
          outcome: 'success',
          linkCount: 1,
          aliasCount: 1
        })
      ),
      withSafeTypedSpan('musicIdentity.attachLink', {
        attributes: {
          origin: input.origin,
          entityType: input.entityType,
          entityId: input.entityId
        }
      })
    )

  const refresh = (input: RefreshMusicEntity, mode: RefreshMode) => {
    const explicitRefresh = mode === 'administrator_refresh'
    return Effect.gen(function* () {
      const reference = { entityType: input.entityType, entityId: input.entityId }
      yield* annotateEntity(reference)
      yield* Effect.annotateCurrentSpan('explicitRefresh', explicitRefresh)
      const current = yield* loadEntity(reference).pipe(provideDb)
      const links = yield* repository.linksFor(reference)
      if (
        !explicitRefresh &&
        links.some(
          (link) => link.status === 'verified' && link.metadata?.confidence !== 'exact_source'
        )
      ) {
        yield* Effect.annotateCurrentSpan({ outcome: 'skipped', linkCount: links.length })
        return {
          entityType: input.entityType,
          entity: current,
          links
        } satisfies RefreshedMusicEntity
      }
      const exactSources = links
        .filter(
          (link) => link.metadata?.confidence === 'exact_source' && link.status === 'verified'
        )
        .sort(compareRefreshSourcePrecedence)
      const sourceLink = exactSources[0]
      if (!sourceLink) {
        return yield* new MusicIdentitySourceLinkNotFound({
          entityType: input.entityType,
          entityId: input.entityId
        })
      }
      const source = yield* parseMusicSource(sourceLink.url, input.entityType)
      yield* annotateSource(source)
      const title = 'name' in current ? current.name : current.title
      const artistName =
        'artistNames' in current ? (current.artistNames ?? []).join(', ') : undefined
      const result = yield* (
        explicitRefresh
          ? scraper.scrape({ entityType: input.entityType, url: source.canonicalUrl })
          : scraper.discoverCrossPlatformLinks({
              entityType: input.entityType,
              url: source.canonicalUrl,
              trackTitle: title,
              artistName
            })
      ).pipe(
        Effect.mapError(providerError),
        Effect.tapError((error) =>
          Effect.annotateCurrentSpan({ provider: error.provider, outcome: 'failure' })
        ),
        Effect.tap(() =>
          Effect.gen(function* () {
            yield* annotateSource(source)
            yield* Effect.annotateCurrentSpan({
              provider: source.platform,
              explicitRefresh,
              outcome: 'success'
            })
          })
        ),
        withSafeTypedSpan('musicIdentity.scrape')
      )
      if (
        result.links.length === 0 &&
        !result.entityMeta?.title &&
        !result.entityMeta?.artistName &&
        !result.entityMeta?.thumbnailUrl &&
        !result.entityMeta?.isrc
      ) {
        return yield* new MusicIdentityInvalidSnapshot({
          message: 'Music refresh returned no metadata or links'
        })
      }
      const scrapedAt = new Date()
      const discoveredLinks = uniqueLinks(source, result, scrapedAt)
      const refreshedLinks =
        input.entityType === 'playlist'
          ? discoveredLinks.filter((link) => link.platform === source.platform)
          : discoveredLinks
      const sources = yield* parseDiscoveredSources(source, refreshedLinks, input.entityType)
      const ownerToken = crypto.randomUUID()
      const ownedSources: ParsedMusicSource[] = []
      for (const discovered of sources) {
        const owner = yield* readReference(discovered)
        if (owner && referenceKey(owner) !== referenceKey(reference)) {
          yield* repository.recordConflict(
            discovered.sourceKey,
            owner,
            reference,
            'refresh_discovered_owned',
            new Date()
          )
          yield* repository.release(
            ownedSources.map((owned) => owned.sourceKey),
            ownerToken
          )
          return yield* new MusicIdentityConflict({
            sourceKey: discovered.sourceKey,
            incumbentEntityType: owner.entityType,
            incumbentEntityId: owner.entityId,
            candidateEntityType: reference.entityType,
            candidateEntityId: reference.entityId
          })
        }
        if (owner) continue
        const claim = yield* claimWithWait(discovered, ownerToken).pipe(
          Effect.tapError(() =>
            repository.release(
              ownedSources.map((owned) => owned.sourceKey),
              ownerToken
            )
          )
        )
        if (claim === 'owned') {
          ownedSources.push(discovered)
          continue
        }
        if (referenceKey(claim) !== referenceKey(reference)) {
          yield* repository.recordConflict(
            discovered.sourceKey,
            claim,
            reference,
            'refresh_discovered_owned',
            new Date()
          )
          yield* repository.release(
            ownedSources.map((owned) => owned.sourceKey),
            ownerToken
          )
          return yield* new MusicIdentityConflict({
            sourceKey: discovered.sourceKey,
            incumbentEntityType: claim.entityType,
            incumbentEntityId: claim.entityId,
            candidateEntityType: reference.entityType,
            candidateEntityId: reference.entityId
          })
        }
      }
      const refreshed = refreshedEntityRecord(
        input.entityType,
        input.entityId,
        result,
        current,
        explicitRefresh ? 'replace_canonical' : 'preserve_canonical'
      )
      const committed = yield* repository
        .updateEntityMetadata({
          entity: refreshed,
          links: refreshedLinks,
          sources,
          ownedSources,
          ownerToken,
          now: new Date()
        })
        .pipe(
          Effect.tapError(() =>
            repository.release(
              ownedSources.map((owned) => owned.sourceKey),
              ownerToken
            )
          ),
          Effect.tap((didCommit) =>
            Effect.gen(function* () {
              yield* annotateSource(source)
              yield* annotateEntity(reference)
              yield* Effect.annotateCurrentSpan({
                outcome: didCommit ? 'success' : 'lost_claim',
                linkCount: refreshedLinks.length,
                aliasCount: sources.length,
                explicitRefresh
              })
            })
          ),
          withSafeTypedSpan('musicIdentity.commit')
        )
      if (!committed) {
        yield* repository.release(
          ownedSources.map((owned) => owned.sourceKey),
          ownerToken
        )
        yield* loadEntity(reference).pipe(provideDb)
        return yield* new MusicIdentityBusy({ retryAfterMs: claimLeaseMs })
      }
      const entity = yield* loadEntity(reference).pipe(provideDb)
      const storedLinks = yield* repository.linksFor(reference)
      yield* Effect.annotateCurrentSpan({
        outcome: 'success',
        linkCount: storedLinks.length,
        aliasCount: sources.length
      })
      return {
        entityType: input.entityType,
        entity,
        links: storedLinks,
        artworkUrl: result.entityMeta?.thumbnailUrl
      } satisfies RefreshedMusicEntity
    }).pipe(
      withSafeTypedSpan('musicIdentity.refreshEntity', {
        attributes: {
          entityType: input.entityType,
          entityId: input.entityId,
          explicitRefresh,
          origin: input.origin
        }
      })
    )
  }

  const releaseLink = (input: ReleaseMusicSourceLink) =>
    Effect.gen(function* () {
      const reference = { entityType: input.entityType, entityId: input.entityId }
      yield* loadEntity(reference).pipe(provideDb)
      const link = yield* repository.linkById(reference, input.linkId)
      if (!link) {
        return yield* new MusicIdentitySourceLinkNotFound({
          entityType: input.entityType,
          entityId: input.entityId
        })
      }
      const source =
        link.metadata?.confidence === 'exact_source'
          ? yield* parseMusicSource(link.url, input.entityType).pipe(
              Effect.catchTag('MusicSourceInvalid', () => Effect.succeed(undefined))
            )
          : undefined
      const released = yield* repository.releaseLink({
        reference,
        linkId: input.linkId,
        source,
        action: input.action,
        verifiedBy: input.verifiedBy,
        metadata: input.metadata ?? link.metadata ?? undefined,
        now: new Date()
      })
      if (input.action === 'reject' && !released) {
        return yield* storageError('releaseLink', 'Rejected link was not persisted')
      }
      return released
    }).pipe(withSafeTypedSpan('musicIdentity.releaseLink'))

  const enrichEntity = (input: RefreshMusicEntity) => refresh(input, 'automatic_enrichment')
  const refreshEntity = (input: RefreshMusicEntity) => refresh(input, 'administrator_refresh')

  return { attachLink, releaseLink, enrichEntity, refreshEntity }
}
