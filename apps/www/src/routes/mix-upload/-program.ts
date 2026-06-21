import * as Effect from 'effect/Effect'
import * as Schedule from 'effect/Schedule'
import { formatTime, generateSlug, type TrackEntry } from '@gbfm/ui'
import { apiUrl, fetcher } from '@/lib/http'
import { readResponseErrorMessage, readUploadResponse } from '@/lib/response'
import { ImageUploadError, NotSignedInError, RecordSaveError, isPageRetryable } from './-errors'

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

const buildRecordPayload = (input: SubmitRecordInput) => {
  const tracklistMarkdown =
    input.formData.tracklist.length > 0
      ? `\n\n## Tracklist\n${input.formData.tracklist
          .map((t, i) => `${i + 1}. ${t.title} (${formatTime(t.time)})`)
          .join('\n')}`
      : ''

  return {
    title: input.formData.title,
    description: input.formData.description,
    slug: input.formData.slug || generateSlug(input.formData.title),
    content: input.formData.content + tracklistMarkdown,
    thumbnailUrl: input.imageUrl,
    url: input.audioUrl,
    type: 'mix',
    tags: input.formData.tags,
    creatorIds: [
      input.formData.creatorId === 'current'
        ? input.userId
        : input.formData.creatorId || input.userId
    ].filter(Boolean),
    showId: input.formData.showId,
    ...(input.formData.episodeNumber ? { episodeNumber: Number(input.formData.episodeNumber) } : {})
  }
}

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
