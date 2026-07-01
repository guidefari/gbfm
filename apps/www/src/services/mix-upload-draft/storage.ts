import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { log } from '@/services/logger'
import { type MixUploadDraft, parseMixUploadDraft } from './types'

const STORAGE_KEY = 'gbfm:mix-upload-draft:v1'

export interface MixUploadDraftStorageShape {
  read: () => Effect.Effect<MixUploadDraft | null>
  write: (value: MixUploadDraft) => Effect.Effect<void>
  clear: () => Effect.Effect<void>
}

export class MixUploadDraftStorage extends Context.Service<
  MixUploadDraftStorage,
  MixUploadDraftStorageShape
>()('@gbfm/www/MixUploadDraftStorage') {}

export const MixUploadDraftStorageLive = Layer.sync(MixUploadDraftStorage, () => ({
  read: () =>
    Effect.sync(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        return parseMixUploadDraft(JSON.parse(raw))
      } catch {
        return null
      }
    }),
  write: (value: MixUploadDraft) =>
    Effect.sync(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch (error) {
        log('warn', 'MixUploadDraftStorage.write failed', { error })
      }
    }),
  clear: () =>
    Effect.sync(() => {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignored
      }
    })
}))

export const MixUploadDraftStorageTest = Layer.succeed(MixUploadDraftStorage, {
  read: () => Effect.succeed(null),
  write: () => Effect.void,
  clear: () => Effect.void
})

export const MixUploadDraftStorageInMemory = Layer.sync(MixUploadDraftStorage, () => {
  let stored: MixUploadDraft | null = null
  return {
    read: () => Effect.sync(() => stored),
    write: (value: MixUploadDraft) =>
      Effect.sync(() => {
        stored = value
      }),
    clear: () =>
      Effect.sync(() => {
        stored = null
      })
  }
})

export const readMixUploadDraft = () => Effect.andThen(MixUploadDraftStorage, (s) => s.read())

export const writeMixUploadDraft = (value: MixUploadDraft) =>
  Effect.andThen(MixUploadDraftStorage, (s) => s.write(value))

export const clearMixUploadDraft = () => Effect.andThen(MixUploadDraftStorage, (s) => s.clear())
