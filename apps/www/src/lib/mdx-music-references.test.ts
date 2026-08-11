import { describe, expect, test } from 'vitest'
import { mdxMusicReferences } from './mdx-music-references'

describe('mdxMusicReferences', () => {
  test('extracts multiline music components with either quote style', () => {
    expect(
      mdxMusicReferences(`
<Album
  url="https://open.spotify.com/album/one?si=abc"
/>
<Track url='https://open.spotify.com/track/two' />
<Playlist title="ignored" url = "https://open.spotify.com/playlist/three" />
`)
    ).toEqual([
      {
        type: 'album',
        encodedUrl: encodeURIComponent('https://open.spotify.com/album/one?si=abc')
      },
      {
        type: 'track',
        encodedUrl: encodeURIComponent('https://open.spotify.com/track/two')
      },
      {
        type: 'playlist',
        encodedUrl: encodeURIComponent('https://open.spotify.com/playlist/three')
      }
    ])
  })

  test('ignores ordinary links and components without a URL', () => {
    expect(mdxMusicReferences('[listen](https://example.com)\n<Album />')).toEqual([])
  })
})
