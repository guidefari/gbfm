import { useEffect, useRef } from 'react'
import { VPS_BASE_URL } from '@/lib/http'
import { RuntimeClient } from '@/runtime'
import { track } from '@/services/analytics'
import { useAudioPlayerStore } from '@/store/audioPlayer'

/**
 * How long (in ms) before the same audio counts as a new play.
 * 30 minutes matches common streaming platform conventions.
 */
const DEDUP_WINDOW_MS = 30 * 60 * 1000
const STORAGE_KEY = 'gbfm_play_sessions'

function getPlaySessions(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function recordPlaySession(trackId: string): void {
  try {
    const sessions = getPlaySessions()
    sessions[trackId] = Date.now()
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // Ignore storage errors silently
  }
}

function isWithinDedupWindow(trackId: string): boolean {
  const sessions = getPlaySessions()
  const lastPlayed = sessions[trackId]
  if (!lastPlayed) return false
  return Date.now() - lastPlayed < DEDUP_WINDOW_MS
}

/**
 * Tracks mix plays via the analytics service and VPS play endpoint.
 *
 * Deduplication: a play is only counted once per audio per 30-minute window
 * within the current browser session (sessionStorage). This prevents
 * accidental double-counting from pause/resume or tab switching.
 *
 * Provider-agnostic: the analytics event goes through the existing Analytics
 * Effect service, so swapping PostHog for another provider only requires
 * changing the layer in runtime/index.ts — no changes here.
 */
export function useMixPlayTracking() {
  const currentTrackId = useAudioPlayerStore((state) => state.currentTrackId)
  const nowPlayingContext = useAudioPlayerStore(
    (state) => state.nowPlayingContext
  )
  const prevTrackIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentTrackId || currentTrackId === prevTrackIdRef.current) return
    prevTrackIdRef.current = currentTrackId

    if (isWithinDedupWindow(currentTrackId)) return
    recordPlaySession(currentTrackId)

    // Fire analytics event through the provider-agnostic service
    void RuntimeClient.runPromise(
      track('audio_played', {
        trackId: currentTrackId,
        title: nowPlayingContext.title,
        slug: nowPlayingContext.slug,
        pageUrl: nowPlayingContext.url
      })
    )

    // Increment play count on the VPS — fire-and-forget
    fetch(`${VPS_BASE_URL}/content/audio/${currentTrackId}/play`, {
      method: 'POST',
      credentials: 'include'
    }).catch(() => {
      // Silently ignore network errors; analytics is the source of truth
    })
  }, [currentTrackId, nowPlayingContext])
}
