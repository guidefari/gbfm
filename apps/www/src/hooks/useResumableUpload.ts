import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiUrl } from '@/lib/http'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { readResponseErrorMessage } from '@/lib/response'
import {
  computeBackoff,
  computeFileFingerprint,
  createPersistedUpload,
  isRetryableStatus,
  mergeCompletedParts,
  missingPartNumbers,
  parseAbortResponse,
  parseCompleteResponse,
  parseInitResponse,
  parsePartResponse,
  parsePersistedUpload,
  parseStatusResponse,
  sleep,
  splitFileIntoChunks,
  withUpdatedPart,
  type PersistedResumableUpload,
  type ResumablePart,
  type ResumableUploadPhase,
  type ResumableUploadResult
} from '@/lib/upload/resumable-upload'

const STORAGE_PREFIX = 'gbfm:resumable-upload:'
const MAX_PART_ATTEMPTS = 5

export interface UseResumableUploadOptions {
  fileType: 'audio'
  onComplete: (result: ResumableUploadResult) => void
  onError?: (error: Error) => void
}

export interface UseResumableUploadState {
  phase: ResumableUploadPhase
  bytesUploaded: number
  totalBytes: number
  currentPart: number
  totalParts: number
  error: Error | null
  result: ResumableUploadResult | null
}

export interface UseResumableUploadReturn {
  state: UseResumableUploadState
  start: (file: File) => Promise<void>
  pause: () => void
  resume: (file: File) => Promise<void>
  cancel: () => Promise<void>
  retry: (file: File) => Promise<void>
  isInProgress: boolean
  isPaused: boolean
  isCompleted: boolean
}

const readStorage = (key: string): PersistedResumableUpload | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return null
    return parsePersistedUpload(JSON.parse(raw))
  } catch {
    return null
  }
}

const writeStorage = (value: PersistedResumableUpload): void => {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + value.fileFingerprint, JSON.stringify(value))
  } catch {
    // ignored: storage may be full or disabled; uploads still work, they just can't resume
  }
}

const clearStorage = (fingerprint: string): void => {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + fingerprint)
  } catch {
    // ignored
  }
}

const initialState: UseResumableUploadState = {
  phase: 'idle',
  bytesUploaded: 0,
  totalBytes: 0,
  currentPart: 0,
  totalParts: 0,
  error: null,
  result: null
}

const uploadPartWithRetry = async (
  uploadId: string,
  key: string,
  part: { partNumber: number; blob: Blob },
  signal: AbortSignal
): Promise<ResumablePart> => {
  const formData = new FormData()
  formData.append('key', key)
  formData.append('uploadId', uploadId)
  formData.append('partNumber', String(part.partNumber))
  formData.append('chunk', part.blob, `part-${part.partNumber}`)

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_PART_ATTEMPTS; attempt += 1) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    try {
      const response = await fetch(apiUrl('/upload/multipart/part'), {
        method: 'POST',
        body: formData,
        signal
      })

      if (response.ok) {
        return parsePartResponse(await response.json())
      }

      if (!isRetryableStatus(response.status) || attempt === MAX_PART_ATTEMPTS) {
        const message = await readResponseErrorMessage(
          response,
          `Part ${part.partNumber} failed (${response.status})`
        )
        throw new Error(message)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt === MAX_PART_ATTEMPTS) throw lastError
    }

    const backoff = computeBackoff(attempt)
    await sleep(backoff, signal)
  }

  throw lastError ?? new Error(`Part ${part.partNumber} failed`)
}

export function useResumableUpload(options: UseResumableUploadOptions): UseResumableUploadReturn {
  const { fileType, onComplete, onError } = options
  const isOnline = useOnlineStatus()

  const [state, setState] = useState<UseResumableUploadState>(initialState)

  const persistedRef = useRef<PersistedResumableUpload | null>(null)
  const fingerprintRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pausedRef = useRef<boolean>(false)

  const transitionTo = useCallback(
    (
      patch:
        | Partial<UseResumableUploadState>
        | ((prev: UseResumableUploadState) => Partial<UseResumableUploadState>)
    ) => {
      setState((prev) => ({
        ...prev,
        ...(typeof patch === 'function' ? patch(prev) : patch)
      }))
    },
    []
  )

  const persist = useCallback((next: PersistedResumableUpload) => {
    persistedRef.current = next
    writeStorage(next)
  }, [])

  const clearAll = useCallback(() => {
    if (fingerprintRef.current) {
      clearStorage(fingerprintRef.current)
    }
    persistedRef.current = null
    fingerprintRef.current = null
    pausedRef.current = false
  }, [])

  const runUpload = useCallback(
    async (file: File, resumeFrom: PersistedResumableUpload | null) => {
      const fingerprint = computeFileFingerprint(file)
      fingerprintRef.current = fingerprint
      pausedRef.current = false
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      transitionTo({
        phase: 'preparing',
        error: null,
        result: null,
        totalBytes: file.size,
        bytesUploaded: 0,
        currentPart: 0
      })

      try {
        let persisted: PersistedResumableUpload
        if (resumeFrom) {
          const statusResponse = await fetch(
            apiUrl(
              `/upload/multipart/status?key=${encodeURIComponent(resumeFrom.key)}&uploadId=${encodeURIComponent(resumeFrom.uploadId)}`
            ),
            { signal }
          )
          if (!statusResponse.ok) {
            const message = await readResponseErrorMessage(
              statusResponse,
              'Failed to fetch upload status'
            )
            throw new Error(message)
          }
          const serverStatus = parseStatusResponse(await statusResponse.json())
          persisted = {
            ...resumeFrom,
            completedParts: mergeCompletedParts(resumeFrom.completedParts, serverStatus.parts),
            updatedAt: Date.now()
          }
        } else {
          const initResponse = await fetch(apiUrl('/upload/multipart/init'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              contentType: file.type,
              fileSize: file.size,
              fileType
            }),
            signal
          })
          if (!initResponse.ok) {
            const message = await readResponseErrorMessage(initResponse, 'Failed to start upload')
            throw new Error(message)
          }
          persisted = createPersistedUpload({
            file,
            fileFingerprint: fingerprint,
            init: parseInitResponse(await initResponse.json())
          })
        }

        persist(persisted)

        const chunks = splitFileIntoChunks(file, persisted.chunkSize)
        const todo = missingPartNumbers(persisted.totalParts, persisted.completedParts)
          .map((partNumber) => chunks[partNumber - 1])
          .filter((chunk): chunk is (typeof chunks)[number] => Boolean(chunk))

        const initialBytes = persisted.completedParts.reduce((sum, p) => sum + p.size, 0)
        transitionTo({
          phase: 'uploading',
          bytesUploaded: initialBytes,
          totalBytes: persisted.totalBytes,
          totalParts: persisted.totalParts,
          currentPart: persisted.completedParts.length
        })

        let working: PersistedResumableUpload = persisted
        for (const chunk of todo) {
          if (pausedRef.current) {
            persist(working)
            transitionTo({ phase: 'paused' })
            return
          }
          if (signal.aborted) return

          const result = await uploadPartWithRetry(
            working.uploadId,
            working.key,
            { partNumber: chunk.partNumber, blob: chunk.blob },
            signal
          )

          working = withUpdatedPart(working, result)
          persist(working)
          transitionTo((prev) => ({
            ...prev,
            bytesUploaded: prev.bytesUploaded + result.size,
            currentPart: Math.min(prev.currentPart + 1, prev.totalParts)
          }))
        }

        if (pausedRef.current) {
          transitionTo({ phase: 'paused' })
          return
        }
        if (signal.aborted) return

        transitionTo({ phase: 'finalizing' })

        const completeResponse = await fetch(apiUrl('/upload/multipart/complete'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: working.key,
            uploadId: working.uploadId,
            parts: working.completedParts.map((p) => ({
              partNumber: p.partNumber,
              etag: p.etag
            }))
          }),
          signal
        })
        if (!completeResponse.ok) {
          const message = await readResponseErrorMessage(
            completeResponse,
            'Failed to complete upload'
          )
          throw new Error(message)
        }

        const completed: ResumableUploadResult = parseCompleteResponse(
          await completeResponse.json()
        )
        clearAll()

        setState({
          phase: 'completed',
          bytesUploaded: working.totalBytes,
          totalBytes: working.totalBytes,
          currentPart: working.totalParts,
          totalParts: working.totalParts,
          error: null,
          result: completed
        })
        onComplete(completed)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        const err = error instanceof Error ? error : new Error(String(error))
        transitionTo({ phase: 'error', error: err })
        onError?.(err)
      }
    },
    [fileType, onComplete, onError, persist, transitionTo, clearAll]
  )

  const start = useCallback((file: File) => runUpload(file, null), [runUpload])

  const resume = useCallback(
    (file: File) => {
      const existing = persistedRef.current
      return runUpload(file, existing)
    },
    [runUpload]
  )

  const pause = useCallback(() => {
    pausedRef.current = true
    setState((prev) => (prev.phase === 'uploading' ? { ...prev, phase: 'paused' } : prev))
  }, [])

  const cancel = useCallback(async () => {
    const persisted = persistedRef.current
    pausedRef.current = true
    abortControllerRef.current?.abort()

    if (persisted) {
      try {
        const response = await fetch(apiUrl('/upload/multipart/abort'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: persisted.key, uploadId: persisted.uploadId })
        })
        if (response.ok) {
          parseAbortResponse(await response.json())
        }
      } catch {
        // The S3 lifecycle rule cleans up abandoned uploads regardless.
      }
    }

    clearAll()
    setState({ ...initialState, phase: 'aborted' })
  }, [clearAll])

  const retry = useCallback(
    (file: File) => {
      const existing = persistedRef.current
      return runUpload(file, existing)
    },
    [runUpload]
  )

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (state.phase !== 'uploading' && state.phase !== 'finalizing') return
    if (isOnline) return
    pausedRef.current = true
    setState((prev) =>
      prev.phase === 'uploading' || prev.phase === 'finalizing'
        ? { ...prev, phase: 'paused' }
        : prev
    )
  }, [isOnline, state.phase])

  return useMemo(
    () => ({
      state,
      start,
      pause,
      resume,
      cancel,
      retry,
      isInProgress:
        state.phase === 'uploading' || state.phase === 'finalizing' || state.phase === 'preparing',
      isPaused: state.phase === 'paused',
      isCompleted: state.phase === 'completed'
    }),
    [state, start, pause, resume, cancel, retry]
  )
}

export const readResumableUpload = (file: File): PersistedResumableUpload | null =>
  readStorage(computeFileFingerprint(file))
