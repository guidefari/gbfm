import * as Effect from 'effect/Effect'
import * as Schedule from 'effect/Schedule'
import type { TrackEntry } from '@gbfm/ui'
import { apiUrl, fetcher } from '@/lib/http'
import { readResponseErrorMessage, readUploadResponse } from '@/lib/response'
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
  Effect.gen(function* () {
    const formData = new FormData()
    formData.append('imageFile', file)
    formData.append('fileType', 'image')

    const response = yield* Effect.tryPromise<globalThis.Response, ImageUploadError>({
      try: () => fetch(apiUrl('/upload/file'), { method: 'POST', body: formData, signal }),
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

    if (!response.ok) {
      const message = yield* Effect.tryPromise<string, ImageUploadError>({
        try: () => readResponseErrorMessage(response, `Image upload failed (${response.status})`),
        catch: () => new ImageUploadError({ message: 'Image upload failed' })
      })
      return yield* new ImageUploadError({ message, status: response.status })
    }

    return yield* Effect.tryPromise({
      try: () => readUploadResponse(response),
      catch: (cause) =>
        new ImageUploadError({
          message: cause instanceof Error ? cause.message : 'Invalid image response'
        })
    })
  })

export const saveRecord = (
  input: SubmitRecordInput,
  signal: AbortSignal
): Effect.Effect<unknown, RecordSaveError | NotSignedInError, never> =>
  Effect.gen(function* () {
    if (!input.userId) {
      return yield* new NotSignedInError({ message: 'Please login/signup to upload content' })
    }

    const endpoint = input.isEditMode
      ? apiUrl(`/content/audio/${input.editType}/${input.editSlug}`)
      : apiUrl('/content/audio')
    const method = input.isEditMode ? 'PATCH' : 'POST'

    return yield* Effect.tryPromise<unknown, RecordSaveError>({
      try: () =>
        fetcher(endpoint, { method, body: JSON.stringify(buildRecordPayload(input)), signal }),
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
