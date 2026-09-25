import { describe, expect, it } from 'vitest'

import { splitLegacySoundCloud } from './legacy-soundcloud'

const soundcloud = (source: string, link: string) =>
  `Before\n<iframe width="100%" src="${source}" />\n<div style={{ color: 'red' }}><a href="${link}">Track</a></div>\nAfter`

describe('legacy SoundCloud content', () => {
  it('renders a trusted player from the public track link and keeps surrounding text', () => {
    const parts = splitLegacySoundCloud(
      soundcloud(
        'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/1817224335',
        'https://soundcloud.com/inkingayomhlaba/sunson-again',
      ),
    )

    expect(parts).toEqual([
      { type: 'text', content: 'Before\n' },
      {
        type: 'embed',
        src: expect.stringMatching(
          /^https:\/\/w\.soundcloud\.com\/player\/\?url=https%3A%2F%2Fsoundcloud\.com%2Finkingayomhlaba%2Fsunson-again/,
        ),
        title: 'SoundCloud player',
        height: 166,
        href: 'https://soundcloud.com/inkingayomhlaba/sunson-again',
      },
      { type: 'text', content: '\nAfter' },
    ])
  })

  it('does not turn an untrusted iframe into an embed', () => {
    const content = soundcloud(
      'https://evil.example/player/?url=https%3A//api.soundcloud.com/tracks/1817224335',
      'https://soundcloud.com/inkingayomhlaba/sunson-again',
    )

    expect(splitLegacySoundCloud(content)).toEqual([{ type: 'text', content }])
  })
})
