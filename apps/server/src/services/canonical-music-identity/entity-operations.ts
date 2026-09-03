import { Effect } from 'effect'
import type { DatabaseClient } from '@/db/layer'
import { Database } from '@/db/layer'
import type {
  MusicLinkScraperService,
  MusicScraperError,
  ScrapedLink
} from '@/services/music-link-scraper.service'
import type { AttachMusicSourceLink, RefreshMusicEntity, RefreshedMusicEntity } from './contract'
import {
  MusicIdentityBusy,
  MusicIdentityConflict,
  type MusicIdentityError,
  MusicIdentityInvalidSnapshot,
  MusicIdentitySourceLinkNotFound,
  MusicIdentityStorageError
} from './errors'
import { loadEntity, refreshedEntityRecord } from './entity-record'
import { parseMusicSource, type ParsedMusicSource } from './music-source'
import { CanonicalMusicIdentityRepository, type EntityReference } from './repository'
import { parseDiscoveredSources, uniqueLinks } from './source-result'

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

export const makeEntityOperations = (
  db: DatabaseClient,
  scraper: MusicLinkScraperService,
  repository: CanonicalMusicIdentityRepository,
  readReference: ReadReference,
  claimWithWait: ClaimWithWait,
  providerError: (error: MusicScraperError) => MusicIdentityError,
  claimLeaseMs: number
) => {
  const provideDb = Effect.provideService(Database, db)

  const attachLink = (input: AttachMusicSourceLink) =>
    Effect.gen(function* () {
      const reference = { entityType: input.entityType, entityId: input.entityId }
      yield* loadEntity(reference).pipe(provideDb)
      const source = yield* parseMusicSource(input.url, input.entityType)
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
          .pipe(Effect.tapError(() => repository.release([source.sourceKey], ownerToken)))
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
    }).pipe(Effect.withSpan('musicIdentity.attachLink'))

  const refreshEntity = (input: RefreshMusicEntity) =>
    Effect.gen(function* () {
      const reference = { entityType: input.entityType, entityId: input.entityId }
      const current = yield* loadEntity(reference).pipe(provideDb)
      const links = yield* repository.linksFor(reference)
      const exactSources = links.filter(
        (link) => link.metadata?.confidence === 'exact_source' && link.status === 'verified'
      )
      const sourceLink = exactSources.length === 1 ? exactSources[0] : undefined
      if (!sourceLink) {
        return yield* new MusicIdentitySourceLinkNotFound({
          entityType: input.entityType,
          entityId: input.entityId
        })
      }
      const source = yield* parseMusicSource(sourceLink.url, input.entityType)
      const result = yield* scraper
        .scrape({ entityType: input.entityType, url: source.canonicalUrl })
        .pipe(
          Effect.mapError(providerError),
          Effect.withSpan('musicIdentity.scrape', {
            attributes: { platform: source.platform, explicitRefresh: true }
          })
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
      const refreshed = refreshedEntityRecord(input.entityType, input.entityId, result, current)
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
          Effect.withSpan('musicIdentity.commit')
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
      return { entity, links: storedLinks } satisfies RefreshedMusicEntity
    }).pipe(
      Effect.withSpan('musicIdentity.refreshEntity', {
        attributes: {
          entityType: input.entityType,
          entityId: input.entityId,
          actorId: input.actorId
        }
      })
    )

  return { attachLink, refreshEntity }
}
