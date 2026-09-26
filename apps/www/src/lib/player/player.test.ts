import { describe, expect, it } from 'vitest'

import { parsePlayTrackEvent } from './player'

describe('parsePlayTrackEvent', () => {
  it('rewrites audio from the retired development CDN to the canonical CDN', () => {
    expect(
      parsePlayTrackEvent({
        title: 'Signal arrives',
        url: 'https://cdn.dev.goosebumps.fm/user-content/signal.mp3',
      }),
    ).toMatchObject({
      url: 'https://cdn.goosebumps.fm/user-content/signal.mp3',
    })
  })

  it('preserves audio hosted outside the retired CDN', () => {
    expect(
      parsePlayTrackEvent({
        title: 'External mix',
        url: 'https://audio.example.com/mix.mp3',
      }),
    ).toMatchObject({
      url: 'https://audio.example.com/mix.mp3',
    })
  })
})
