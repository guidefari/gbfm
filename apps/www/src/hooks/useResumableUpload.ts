import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Predicate from 'effect/Predicate'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { runAppEffect } from '@/runtime'
import {
  AlreadyInProgressError,
  type PersistedResumableUpload,
  type ResumableUploadError,
  type ResumableUploadResult,
  ResumableUploadStorage,
  UnknownError,
  cancelProgram,
  uploadProgram
} from '@/services/resumable-upload'
import { computeFileFingerprint } from '@/lib/upload/resumable-upload'

export type {
  PersistedResumableUpload,
  ResumableUploadError,
  ResumableUploadResult
} from '@/services/resumable-upload'

export type ResumableUploadPhase =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'paused'
  | 'finalizing'
  | 'completed'
  | 'aborted'
  | 'error'

export type ResumableUploadOutcome =
  | { readonly _tag: 'Success'; readonly result: ResumableUploadResult }
  | { readonly _tag: 'Paused'; readonly checkpoint: PersistedResumableUpload }
  | { readonly _tag: 'Aborted' }
  | { readonly _tag: 'Error'; readonly error: ResumableUploadError }

export interface UseResumableUploadState {
  phase: ResumableUploadPhase
  bytesUploaded: number
  totalBytes: number
  currentPart: number
  totalParts: number
  error: ResumableUploadError | null
  result: ResumableUploadResult | null
  checkpoint: PersistedResumableUpload | null
}

export interface UseResumableUploadReturn {
  state: UseResumableUploadState
  start: (file: File) => Promise<ResumableUploadOutcome>
  resume: (file: File) => Promise<ResumableUploadOutcome>
  cancel: () => Promise<void>
  isInProgress: boolean
  isPaused: boolean
  isCompleted: boolean
  hasInProgress: boolean
}

const initialState: UseResumableUploadState = {
  phase: 'idle',
  bytesUploaded: 0,
  totalBytes: 0,
  currentPart: 0,
  totalParts: 0,
  error: null,
  result: null,
  checkpoint: null
}

const inProgressPhase = (phase: ResumableUploadPhase): boolean =>
  phase === 'preparing' || phase === 'uploading' || phase === 'finalizing'

const outcomeFromExit = (
  exit: Exit.Exit<ResumableUploadResult, ResumableUploadError>
): ResumableUploadOutcome => {
  if (Exit.isSuccess(exit)) {
    return { _tag: 'Success', result: exit.value }
  }
  const errorOpt = Cause.findErrorOption(exit.cause)
  if (errorOpt._tag === 'None') {
    return { _tag: 'Error', error: new UnknownError({ message: 'Unexpected upload failure' }) }
  }
  const error = errorOpt.value
  if (error._tag === 'UploadAborted') return { _tag: 'Aborted' }
  if (error._tag === 'UploadPaused') return { _tag: 'Paused', checkpoint: error.checkpoint }
  return { _tag: 'Error', error }
}

export function useResumableUpload(): UseResumableUploadReturn {
  const isOnline = useOnlineStatus()
  const [state, setState] = useState<UseResumableUploadState>(initialState)
  const checkpointRef = useRef<PersistedResumableUpload | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const activeUploadRef = useRef<Promise<
    Exit.Exit<ResumableUploadResult, ResumableUploadError>
  > | null>(null)
  const pausedRef = useRef<boolean>(false)

  const transitionTo = useCallback(
    (
      patch:
        | Partial<UseResumableUploadState>
        | ((prev: UseResumableUploadState) => Partial<UseResumableUploadState>)
    ) =>
      setState((prev) => ({
        ...prev,
        ...(Predicate.isFunction(patch) ? patch(prev) : patch)
      })),
    []
  )

  const setCheckpoint = useCallback(
    (checkpoint: PersistedResumableUpload | null) => {
      checkpointRef.current = checkpoint
      transitionTo({ checkpoint })
    },
    [transitionTo]
  )

  const loadCheckpoint = useCallback(
    async (file: File): Promise<PersistedResumableUpload | null> => {
      const fingerprint = computeFileFingerprint(file)
      return runAppEffect(
        Effect.andThen(ResumableUploadStorage, (storage) => storage.read(fingerprint))
      ).catch(() => null)
    },
    []
  )

  const runUpload = useCallback(
    async (
      file: File,
      resumeFrom: PersistedResumableUpload | null
    ): Promise<ResumableUploadOutcome> => {
      if (inProgressPhase(state.phase)) {
        return {
          _tag: 'Error',
          error: new AlreadyInProgressError({ message: 'Upload already in progress' })
        }
      }

      pausedRef.current = false
      const controller = new AbortController()
      abortControllerRef.current = controller

      transitionTo({
        phase: 'preparing',
        error: null,
        result: null,
        totalBytes: file.size,
        bytesUploaded: 0,
        currentPart: 0,
        totalParts: 0,
        checkpoint: resumeFrom
      })
      checkpointRef.current = resumeFrom

      const program = uploadProgram(
        { file, fileType: 'audio' },
        {
          signal: controller.signal,
          isPaused: () => pausedRef.current,
          onProgress: (progress) => {
            setState((prev) => ({ ...prev, ...progress }))
          },
          onCheckpoint: setCheckpoint,
          checkpoint: resumeFrom ?? undefined
        }
      )

      const activeUpload = runAppEffect(Effect.exit(program))
      activeUploadRef.current = activeUpload
      const exit = await activeUpload
      if (activeUploadRef.current === activeUpload) {
        activeUploadRef.current = null
      }
      const outcome = outcomeFromExit(exit)

      if (outcome._tag === 'Success') {
        setCheckpoint(null)
        transitionTo({ result: outcome.result })
      } else if (outcome._tag === 'Paused') {
        setCheckpoint(outcome.checkpoint)
      } else if (outcome._tag === 'Error') {
        transitionTo({ error: outcome.error })
      }

      return outcome
    },
    [state.phase, transitionTo, setCheckpoint]
  )

  const start = useCallback(
    async (file: File): Promise<ResumableUploadOutcome> => {
      if (inProgressPhase(state.phase)) {
        return {
          _tag: 'Error',
          error: new AlreadyInProgressError({ message: 'Upload already in progress' })
        }
      }
      const checkpoint = await loadCheckpoint(file)
      return runUpload(file, checkpoint)
    },
    [state.phase, loadCheckpoint, runUpload]
  )

  const resume = useCallback(
    async (file: File): Promise<ResumableUploadOutcome> => {
      if (inProgressPhase(state.phase)) {
        return {
          _tag: 'Error',
          error: new AlreadyInProgressError({ message: 'Upload already in progress' })
        }
      }
      const checkpoint = checkpointRef.current ?? (await loadCheckpoint(file))
      return runUpload(file, checkpoint)
    },
    [state.phase, loadCheckpoint, runUpload]
  )

  const cancel = useCallback(async () => {
    const controller = abortControllerRef.current
    controller?.abort()

    // Let the canceled run stop first so it cannot persist another checkpoint
    // after cancellation cleanup has removed the current one.
    await activeUploadRef.current?.catch(() => undefined)

    const checkpoint = checkpointRef.current
    if (checkpoint) {
      const abortController = new AbortController()
      const timeout = window.setTimeout(() => abortController.abort(), 10_000)
      await runAppEffect(cancelProgram(checkpoint, abortController.signal)).catch(() => undefined)
      window.clearTimeout(timeout)
    }
    checkpointRef.current = null
    abortControllerRef.current = null
    pausedRef.current = false
    setState({ ...initialState, phase: 'aborted' })
  }, [])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!inProgressPhase(state.phase)) return
    if (isOnline) return
    pausedRef.current = true
    setState((prev) => (inProgressPhase(prev.phase) ? { ...prev, phase: 'paused' } : prev))
  }, [isOnline, state.phase])

  const hasInProgress = state.checkpoint !== null && state.phase !== 'completed'

  return useMemo(
    () => ({
      state,
      start,
      resume,
      cancel,
      isInProgress: inProgressPhase(state.phase),
      isPaused: state.phase === 'paused',
      isCompleted: state.phase === 'completed',
      hasInProgress
    }),
    [state, start, resume, cancel, hasInProgress]
  )
}
