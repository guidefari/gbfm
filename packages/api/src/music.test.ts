import { Exit, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  AddEntityLinkInput,
  CreateAlbumInput,
  CreatePlaylistInput,
  CreateTrackInput,
  PendingLinksQuery,
  UpdateAlbumInput,
  UpdateEntityLinkStatusInput,
  UpdatePlaylistInput,
  UpdateTrackInput
} from './music'

describe('music API contract', () => {
  // Adversarial review found that a plain Schema.String for title/slug let an
  // empty slug through to the DB (varchar NOT NULL accepts ''), unlike the
  // old Zod schemas' .min(1).
  describe('create schemas reject empty title/slug', () => {
    it('CreateAlbumInput rejects an empty slug', () => {
      const result = Schema.decodeUnknownExit(CreateAlbumInput)({ title: 'x', slug: '' })
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('CreateTrackInput rejects an empty title', () => {
      const result = Schema.decodeUnknownExit(CreateTrackInput)({ title: '', slug: 'x' })
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('CreatePlaylistInput rejects an empty title and slug', () => {
      const result = Schema.decodeUnknownExit(CreatePlaylistInput)({ title: '', slug: '' })
      expect(Exit.isFailure(result)).toBe(true)
    })
  })

  // Same review: the admin edit forms (apps/www's -MusicEntityDetailPage.tsx)
  // submit full form state on every save, not a diff -- an unset field
  // arrives as null, not absent. Schema.optional alone (absent-or-value)
  // rejected that; every optional Update*Input field must also accept null.
  describe('update schemas accept null for unset fields', () => {
    it('UpdateAlbumInput accepts null for coverImageUrl/releaseDate/genres/artistIds', () => {
      const result = Schema.decodeUnknownSync(UpdateAlbumInput)({
        title: 'New Title',
        coverImageUrl: null,
        releaseDate: null,
        genres: null,
        artistIds: null
      })
      expect(result.coverImageUrl).toBeNull()
      expect(result.releaseDate).toBeNull()
    })

    it('UpdateTrackInput accepts null for coverImageUrl/albumId/trackNumber', () => {
      const result = Schema.decodeUnknownSync(UpdateTrackInput)({
        coverImageUrl: null,
        albumId: null,
        trackNumber: null
      })
      expect(result.coverImageUrl).toBeNull()
      expect(result.albumId).toBeNull()
    })

    it('UpdatePlaylistInput accepts null for description/curatorId', () => {
      const result = Schema.decodeUnknownSync(UpdatePlaylistInput)({
        description: null,
        curatorId: null
      })
      expect(result.description).toBeNull()
    })
  })

  // Adversarial review on the entity-links PR: AddEntityLinkInput.url must
  // reject non-URL strings (matches the old Zod schema's .url()).
  describe('AddEntityLinkInput', () => {
    it('rejects a non-URL string for url', () => {
      const result = Schema.decodeUnknownExit(AddEntityLinkInput)({
        platform: 'spotify',
        url: 'not-a-url'
      })
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('accepts a real URL', () => {
      const result = Schema.decodeUnknownSync(AddEntityLinkInput)({
        platform: 'spotify',
        url: 'https://open.spotify.com/artist/x'
      })
      expect(result.url).toBe('https://open.spotify.com/artist/x')
    })
  })

  // Same review: metadata must accept null, matching every other
  // Update*Input field -- a plain Schema.optional (absent-or-value)
  // rejected null, which admin tooling could plausibly send.
  describe('UpdateEntityLinkStatusInput', () => {
    it('accepts null for metadata', () => {
      const result = Schema.decodeUnknownSync(UpdateEntityLinkStatusInput)({
        status: 'verified',
        metadata: null
      })
      expect(result.metadata).toBeNull()
    })
  })

  // Same review: limit/offset had no bounds checking, unlike the old Zod
  // schema's .min(1).max(100) / .min(0) -- an admin-authenticated caller
  // could request a negative offset or an unbounded limit.
  describe('PendingLinksQuery', () => {
    it('rejects a limit outside 1-100', () => {
      const tooLow = Schema.decodeUnknownExit(PendingLinksQuery)({ limit: '0' })
      const tooHigh = Schema.decodeUnknownExit(PendingLinksQuery)({ limit: '101' })

      expect(Exit.isFailure(tooLow)).toBe(true)
      expect(Exit.isFailure(tooHigh)).toBe(true)
    })

    it('rejects a negative offset', () => {
      const result = Schema.decodeUnknownExit(PendingLinksQuery)({ offset: '-1' })
      expect(Exit.isFailure(result)).toBe(true)
    })

    it('accepts valid limit/offset within bounds', () => {
      const result = Schema.decodeUnknownSync(PendingLinksQuery)({ limit: '50', offset: '0' })
      expect(result.limit).toBe(50)
      expect(result.offset).toBe(0)
    })
  })
})
