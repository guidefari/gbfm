import { describe, expect, it } from 'vitest'
import type { QueueTrackType } from '@gbfm/player'
import {
  activeQueueTrack,
  isActivePreview,
  isActiveQueueTrack,
  noneSource,
  previewSource,
  queueSource,
  resolvePlayTrackBinding,
  routesTransportToElement,
  showsPlayerChrome
} from './activeSource'

const track = (id: string): QueueTrackType => ({
  id,
  title: id,
  slug: id,
  url: `https://cdn.example/${id}.mp3`,
  thumbnailUrl: null,
  type: 'mix'
})

describe('activeSource', () => {
  it('routes transport to the element only for previews', () => {
    expect(routesTransportToElement(noneSource)).toBe(false)
    expect(routesTransportToElement(queueSource(track('a')))).toBe(false)
    expect(routesTransportToElement(previewSource('https://p'))).toBe(true)
  })

  it('shows player chrome only for queue sources', () => {
    expect(showsPlayerChrome(noneSource)).toBe(false)
    expect(showsPlayerChrome(queueSource(track('a')))).toBe(true)
    expect(showsPlayerChrome(previewSource('https://p'))).toBe(false)
  })

  it('exposes the audible queue track and not a stale selection during preview', () => {
    expect(activeQueueTrack(queueSource(track('a')))?.id).toBe('a')
    expect(activeQueueTrack(previewSource('https://p'))).toBeNull()
    expect(isActiveQueueTrack(queueSource(track('a')), 'a')).toBe(true)
    expect(isActiveQueueTrack(previewSource('https://p'), 'a')).toBe(false)
    expect(isActivePreview(previewSource('https://p'), 'https://p')).toBe(true)
  })

  it('replays an existing session when the active source is already that track', () => {
    const a = track('a')
    expect(
      resolvePlayTrackBinding({
        active: queueSource(a),
        selectedQueueTrack: a,
        track: a
      })
    ).toEqual({ _tag: 'playExistingSession', trackId: 'a' })
  })

  it('rebinds when the selected queue track matches but a preview is active', () => {
    const a = track('a')
    expect(
      resolvePlayTrackBinding({
        active: previewSource('https://p'),
        selectedQueueTrack: a,
        track: a
      })
    ).toEqual({ _tag: 'rebindQueueSession', track: a })
  })

  it('starts a new session when selecting a different track', () => {
    const a = track('a')
    const b = track('b')
    expect(
      resolvePlayTrackBinding({
        active: queueSource(a),
        selectedQueueTrack: a,
        track: b
      })
    ).toEqual({ _tag: 'startNewQueueSession', track: b })
  })
})
