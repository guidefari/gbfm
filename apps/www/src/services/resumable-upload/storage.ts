import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { parsePersistedUpload, type PersistedResumableUpload } from '@/lib/upload/resumable-upload'

const KEY = (fingerprint: string) => `gbfm:resumable-upload:${fingerprint}`

export interface ResumableUploadStorageShape {
  read: (fileFingerprint: string) => Effect.Effect<PersistedResumableUpload | null>
  write: (value: PersistedResumableUpload) => Effect.Effect<void>
  clear: (fileFingerprint: string) => Effect.Effect<void>
}

export class ResumableUploadStorage extends Context.Service<
  ResumableUploadStorage,
  ResumableUploadStorageShape
>()('@gbfm/www/ResumableUploadStorage') {}

export const ResumableUploadStorageLive = Layer.sync(ResumableUploadStorage, () => ({
  read: (fingerprint: string) =>
    Effect.sync(() => {
      try {
        const raw = window.localStorage.getItem(KEY(fingerprint))
        if (!raw) return null
        return parsePersistedUpload(JSON.parse(raw))
      } catch {
        return null
      }
    }),
  write: (value: PersistedResumableUpload) =>
    Effect.sync(() => {
      try {
        window.localStorage.setItem(KEY(value.fileFingerprint), JSON.stringify(value))
      } catch (error) {
        console.warn('ResumableUploadStorage.write failed', error)
      }
    }),
  clear: (fingerprint: string) =>
    Effect.sync(() => {
      try {
        window.localStorage.removeItem(KEY(fingerprint))
      } catch {
        // ignored
      }
    })
}))

export const ResumableUploadStorageTest = Layer.succeed(ResumableUploadStorage, {
  read: () => Effect.succeed(null),
  write: () => Effect.void,
  clear: () => Effect.void
})

export const ResumableUploadStorageInMemory = Layer.sync(ResumableUploadStorage, () => {
  const store = new Map<string, PersistedResumableUpload>()
  return {
    read: (fingerprint: string) => Effect.sync(() => store.get(fingerprint) ?? null),
    write: (value: PersistedResumableUpload) =>
      Effect.sync(() => {
        store.set(value.fileFingerprint, value)
      }),
    clear: (fingerprint: string) =>
      Effect.sync(() => {
        store.delete(fingerprint)
      })
  }
})

export const readCheckpoint = (fingerprint: string) =>
  Effect.andThen(ResumableUploadStorage, (s) => s.read(fingerprint))

export const writeCheckpoint = (value: PersistedResumableUpload) =>
  Effect.andThen(ResumableUploadStorage, (s) => s.write(value))

export const clearCheckpoint = (fingerprint: string) =>
  Effect.andThen(ResumableUploadStorage, (s) => s.clear(fingerprint))
