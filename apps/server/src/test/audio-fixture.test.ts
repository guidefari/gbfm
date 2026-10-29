import { describe, expect, it } from 'vitest'

import { createAudioFixtureResponse } from './audio-fixture'

const audio = new Uint8Array([1, 2, 3, 4])

const request = (range: string) => new Request('http://localhost/audio.wav', { headers: { range } })

describe('local audio fixture', () => {
  it('serves the byte ranges requested by native players', async () => {
    const response = createAudioFixtureResponse(request('bytes=0-1'), audio)

    expect(response.status).toBe(206)
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(response.headers.get('content-range')).toBe('bytes 0-1/4')
    expect(response.headers.get('content-length')).toBe('2')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2]))
  })

  it.each(['bytes=2-', 'bytes=2-100'])('bounds the response for %s', async (range) => {
    const response = createAudioFixtureResponse(request(range), audio)

    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 2-3/4')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([3, 4]))
  })

  it.each(['bytes=4-', 'bytes=3-1', 'bytes=nope', 'bytes=0-1,2-3'])('rejects %s', (range) => {
    const response = createAudioFixtureResponse(request(range), audio)

    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */4')
  })

  it('returns the complete audio without a range', async () => {
    const response = createAudioFixtureResponse(new Request('http://localhost/audio.wav'), audio)

    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(audio)
  })

  it('serves HEAD metadata without a body', async () => {
    const response = createAudioFixtureResponse(
      new Request('http://localhost/audio.wav', { method: 'HEAD' }),
      audio,
    )

    expect(response.headers.get('content-length')).toBe('4')
    expect(await response.text()).toBe('')
  })
})
