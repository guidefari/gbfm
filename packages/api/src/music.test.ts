import { Exit, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  CreateAlbumInput,
  CreatePlaylistInput,
  CreateTrackInput,
  UpdateAlbumInput,
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
})
