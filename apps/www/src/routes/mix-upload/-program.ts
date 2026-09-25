import type { TrackEntry } from '@gbfm/ui'
import * as Effect from 'effect/Effect'
import * as Predicate from 'effect/Predicate'
import * as Schedule from 'effect/Schedule'

import { HttpStatusError, uploadImageDirectToS3 } from '@/lib/upload/image-upload'

import { ImageUploadError, NotSignedInError, RecordSaveError, isPageRetryable } from './-errors'
import { buildRecordPayload } from './-payload'

export interface MixFormData {
  title: string
  description: string
  slug: string
  content: string
  thumbnailUrl: string
  tags: Array<string>
  tracklist: Array<TrackEntry>
  draft: boolean
  creatorId?: string
  url?: string
  showId?: string
  episodeNumber?: string
}

export interface SubmitRecordInput {
  userId: string
  formData: MixFormData
  imageUrl: string
  audioUrl: string
  isEditMode: boolean
  editSlug: string
  editType: 'mix' | 'set' | 'live'
}

const RETRY_TIMES = 3

export const uploadImage = (
  file: File,
  signal: AbortSignal,
): Effect.Effect<{ url: string; key: string }, ImageUploadError> =>
  Effect.tryPromise({
    try: () => uploadImageDirectToS3(file, signal),
    catch: (cause) => {
      const message = cause instanceof Error ? cause.message : String(cause)

      return cause instanceof HttpStatusError
        ? new ImageUploadError({ message, status: cause.status })
        : new ImageUploadError({ message })
    },
  }).pipe(
    Effect.retry({
      schedule: Schedule.exponential('500 millis'),
      times: RETRY_TIMES,
      while: (e) => isPageRetryable(e),
    }),
  )

export const saveRecord = (
  input: SubmitRecordInput,
  signal: AbortSignal,
): Effect.Effect<unknown, RecordSaveError | NotSignedInError> => {
  const idempotencyKey = input.isEditMode ? undefined : crypto.randomUUID()

  return Effect.gen(function* () {
    if (!input.userId) {
      return yield* new NotSignedInError({ message: 'Please login/signup to upload content' })
    }

    const endpoint = input.isEditMode
      ? `/api/content/audio/${input.editType}/${input.editSlug}`
      : '/api/content/audio'

    const method = input.isEditMode ? 'PATCH' : 'POST'
    const payload = buildRecordPayload(input)
    const body = JSON.stringify(idempotencyKey ? { ...payload, idempotencyKey } : payload)

    return yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch(endpoint, {
          method,
          body,
          signal,
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
        })

        if (!response.ok) throw new Error(`Record save failed (${response.status})`)
        const text = await response.text()

        return text ? JSON.parse(text) : undefined
      },
      catch: (cause) =>
        new RecordSaveError({
          message: cause instanceof Error ? cause.message : 'Network error',
        }),
    }).pipe(
      Effect.retry({
        schedule: Schedule.exponential('500 millis'),
        times: RETRY_TIMES,
        while: (error) => Predicate.isTagged(error, 'RecordSaveError') && isPageRetryable(error),
      }),
    )
  })
}
