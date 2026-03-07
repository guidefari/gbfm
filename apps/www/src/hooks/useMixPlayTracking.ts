import { useEffect, useRef } from 'react'
import { VPS_BASE_URL } from '@/lib/http'
import { useAudioPlayerStore } from '@/store/audioPlayer'

/**
 * How long (in ms) before the same audio counts as a new play.
 * 30 minutes matches common streaming platform conventions.
 */
const DEDUP_WINDOW_MS = 30 * 60 * 1000
const STORAGE_KEY = 'gbfm_play_sessions'

function getPlaySessions(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function recordPlaySession(trackId: string): void {
  try {
    const sessions = getPlaySessions()
    sessions[trackId] = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {}
}

function isWithinDedupWindow(trackId: string): boolean {
  const sessions = getPlaySessions()
  const lastPlayed = sessions[trackId]
  if (!lastPlayed) return false
  return Date.now() - lastPlayed < DEDUP_WINDOW_MS
}

/**
 * Increments the VPS play count for mixes/shows.
 * Deduplicates within a 30-minute window (localStorage so it survives reloads).
 * Analytics events are fired separately in loadTrack (covers all audio types).
 */
export function useMixPlayTracking() {
  const currentTrackId = useAudioPlayerStore((state) => state.currentTrackId)
  const isPlaying = useAudioPlayerStore((state) => state.isPlaying)
  const hasTrackedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentTrackId || !isPlaying) return
    if (hasTrackedRef.current === currentTrackId) return
    hasTrackedRef.current = currentTrackId

    if (isWithinDedupWindow(currentTrackId)) return
    recordPlaySession(currentTrackId)

    fetch(`${VPS_BASE_URL}/content/audio/${currentTrackId}/play`, {
      method: 'POST',
      credentials: 'include'
    }).catch(() => {})
  }, [currentTrackId, isPlaying])
}
