import { useCallback, useEffect, useRef, useState } from 'react'
import { computeFileFingerprint } from '@/lib/upload/resumable-upload'
import { runAppEffect } from '@/runtime'
import { log } from '@/services/logger'
import {
  type MixUploadDraft,
  MixUploadDraftStorage,
  clearMixUploadDraft,
  emptyMixUploadDraft,
  readMixUploadDraft
} from '@/services/mix-upload-draft'
import * as Effect from 'effect/Effect'

export interface MixUploadDraftInput {
  title: string
  description: string
  slug: string
  content: string
  thumbnailUrl: string
  tags: readonly string[]
  tracklist: ReadonlyArray<{ id: number; time: number; title: string }>
  showId?: string
  episodeNumber?: string
  creatorId?: string
  url?: string
  audioFile: File | null
  artworkFile: File | null
}

export interface UseMixUploadDraftReturn {
  draft: MixUploadDraft | null
  isLoaded: boolean
  saveDraft: (input: MixUploadDraftInput) => void
  clearDraft: () => Promise<void>
  hasDraft: boolean
}

const DEBOUNCE_MS = 600

const toDraft = (input: MixUploadDraftInput, prev: MixUploadDraft): MixUploadDraft => ({
  ...prev,
  title: input.title,
  description: input.description,
  slug: input.slug,
  content: input.content,
  thumbnailUrl: input.thumbnailUrl,
  tags: [...input.tags],
  tracklist: input.tracklist.map((t) => ({ id: t.id, time: t.time, title: t.title })),
  showId: input.showId,
  episodeNumber: input.episodeNumber,
  creatorId: input.creatorId,
  url: input.url,
  audioFingerprint: input.audioFile
    ? computeFileFingerprint(input.audioFile)
    : prev.audioFingerprint,
  audioFileName: input.audioFile?.name ?? prev.audioFileName,
  artworkFingerprint: input.artworkFile
    ? computeFileFingerprint(input.artworkFile)
    : prev.artworkFingerprint,
  artworkFileName: input.artworkFile?.name ?? prev.artworkFileName,
  updatedAt: Date.now()
})

export function useMixUploadDraft(): UseMixUploadDraftReturn {
  const [draft, setDraft] = useState<MixUploadDraft | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef<MixUploadDraft | null>(null)
  latestRef.current = draft

  useEffect(() => {
    let cancelled = false
    runAppEffect(readMixUploadDraft)
      .then((value) => {
        if (cancelled) return
        setDraft(value)
      })
      .catch(() => {
        if (cancelled) return
        setDraft(null)
      })
      .finally(() => {
        if (cancelled) return
        setIsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const saveDraft = useCallback((input: MixUploadDraftInput) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const prev = latestRef.current ?? emptyMixUploadDraft()
      const next = toDraft(input, prev)
      latestRef.current = next
      setDraft(next)
      runAppEffect(Effect.andThen(MixUploadDraftStorage, (s) => s.write(next))).catch((error) => {
        log('warn', 'Failed to save mix upload draft', { error })
      })
    }, DEBOUNCE_MS)
  }, [])

  const clearDraftFn = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    latestRef.current = null
    setDraft(null)
    await runAppEffect(clearMixUploadDraft).catch(() => undefined)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return {
    draft,
    isLoaded,
    saveDraft,
    clearDraft: clearDraftFn,
    hasDraft: draft !== null
  }
}
