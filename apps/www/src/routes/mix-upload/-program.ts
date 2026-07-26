import * as Effect from 'effect/Effect'
import * as Schedule from 'effect/Schedule'
import type { TrackEntry } from '@gbfm/ui'
import { apiUrl, fetcher } from '@/lib/http'
import { uploadImageDirectToS3 } from '@/lib/upload/image-upload'
import { ImageUploadError, NotSignedInError, RecordSaveError, isPageRetryable } from './-errors'
import { buildRecordPayload } from './-payload'

export interface MixFormData {
  title: string
  description: string
  slug: string
  content: string
  thumbnailUrl: string
  tags: string[]
  tracklist: TrackEntry[]
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
  signal: AbortSignal
): Effect.Effect<{ url: string; key: string }, ImageUploadError, never> =>
  Effect.tryPromise<{ url: string; key: string }, ImageUploadError>({
    try: () => uploadImageDirectToS3(file, signal),
    catch: (cause) =>
      new ImageUploadError({
        message: cause instanceof Error ? cause.message : String(cause)
      })
  }).pipe(
    Effect.retry({
      schedule: Schedule.exponential('500 millis'),
      times: RETRY_TIMES,
      while: (e) => isPageRetryable(e)
    })
  )

export const saveRecord = (
  input: SubmitRecordInput,
  signal: AbortSignal
): Effect.Effect<unknown, RecordSaveError | NotSignedInError, never> => {
  const idempotencyKey = input.isEditMode ? undefined : crypto.randomUUID()

  return Effect.gen(function* () {
    if (!input.userId) {
      return yield* new NotSignedInError({ message: 'Please login/signup to upload content' })
    }

    const endpoint = input.isEditMode
      ? apiUrl(`/content/audio/${input.editType}/${input.editSlug}`)
      : apiUrl('/content/audio')
    const method = input.isEditMode ? 'PATCH' : 'POST'
    const payload = buildRecordPayload(input)
    const body = JSON.stringify(idempotencyKey ? { ...payload, idempotencyKey } : payload)

    return yield* Effect.tryPromise<unknown, RecordSaveError>({
      try: () => fetcher(endpoint, { method, body, signal }),
      catch: (cause) =>
        new RecordSaveError({
          message: cause instanceof Error ? cause.message : 'Network error'
        })
    }).pipe(
      Effect.retry({
        schedule: Schedule.exponential('500 millis'),
        times: RETRY_TIMES,
        while: (e) => e._tag === 'RecordSaveError' && isPageRetryable(e)
      })
    )
  })
}
