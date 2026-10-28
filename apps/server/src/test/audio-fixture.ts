export function createAudioFixtureResponse(request: Request, audio: Uint8Array): Response {
  const headers = new Headers({
    'content-type': 'audio/wav',
    'accept-ranges': 'bytes',
    'content-length': String(audio.byteLength),
  })

  const range = request.headers.get('range')

  if (range === null) {
    return new Response(request.method === 'HEAD' ? null : audio, { headers })
  }

  const match = /^bytes=(\d+)-(\d*)$/.exec(range)
  const start = Number(match?.[1])
  const end = match?.[2] ? Number(match[2]) : audio.byteLength - 1

  if (
    !match ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    start >= audio.byteLength
  ) {
    headers.set('content-range', `bytes */${audio.byteLength}`)
    headers.set('content-length', '0')

    return new Response(null, { status: 416, headers })
  }

  const lastByte = Math.min(end, audio.byteLength - 1)
  headers.set('content-range', `bytes ${start}-${lastByte}/${audio.byteLength}`)
  headers.set('content-length', String(lastByte - start + 1))

  return new Response(request.method === 'HEAD' ? null : audio.slice(start, lastByte + 1), {
    status: 206,
    headers,
  })
}
