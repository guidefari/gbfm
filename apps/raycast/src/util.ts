import { Data, Effect, pipe } from 'effect'

const TracklistFormat = {
  DJ_SOFTWARE_EXPORT: 'dj_software_export',
  MARKDOWN_LIST: 'markdown_list',
  PLAIN_TEXT_LIST: 'plain_text_list',
  UNKNOWN: 'unknown'
} as const

type TracklistFormatType =
  (typeof TracklistFormat)[keyof typeof TracklistFormat]

// Domain-specific errors
class EmptyInputError extends Data.TaggedError('EmptyInputError')<{
  readonly input: string
}> {}

function detectTracklistFormat(input: string): TracklistFormatType {
  const lines = input
    .trim()
    .split('\n')
    .filter((line) => line.trim())

  if (lines.length === 0) {
    return TracklistFormat.UNKNOWN
  }

  const hasTabDelimitedHeader = lines.some(
    (line) =>
      line.trim().match(/^#\s*Artist\s*Track/i) ||
      line.trim().match(/^#.*\t.*Artist.*\t.*Track/i)
  )

  const hasTabDelimitedTracks = lines.some((line) =>
    line.trim().match(/^\d+\t/)
  )

  if (hasTabDelimitedHeader || hasTabDelimitedTracks) {
    return TracklistFormat.DJ_SOFTWARE_EXPORT
  }

  const hasMarkdownBullets = lines.some((line) => line.trim().startsWith('- '))

  if (hasMarkdownBullets) {
    return TracklistFormat.MARKDOWN_LIST
  }

  return TracklistFormat.PLAIN_TEXT_LIST
}

function parseDjSoftwareExport(input: string): string[] {
  const lines = input
    .trim()
    .split('\n')
    .filter((line) => line.trim())
  const tracks: string[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    if (trimmedLine.match(/^\d+\t/)) {
      const parts = trimmedLine.split('\t')
      if (parts.length >= 3) {
        const artist = parts[1].trim()
        const track = parts[2].trim()
        if (artist && track) {
          tracks.push(`${artist} - ${track}`)
        }
      }
    }
  }

  return tracks
}

function parseMarkdownList(input: string): string[] {
  const lines = input
    .trim()
    .split('\n')
    .filter((line) => line.trim())
  const tracks: string[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine.startsWith('- ')) {
      tracks.push(trimmedLine.substring(2).trim())
    } else if (trimmedLine && !trimmedLine.match(/^\d+$/)) {
      tracks.push(trimmedLine)
    }
  }

  return tracks
}

function parsePlainTextList(input: string): string[] {
  const lines = input
    .trim()
    .split('\n')
    .filter((line) => line.trim())
  const tracks: string[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine && !trimmedLine.match(/^\d+$/)) {
      tracks.push(trimmedLine)
    }
  }

  return tracks
}

function formatTracksAsJSX(tracks: string[]): string {
  if (tracks.length === 0) {
    return '<Tracklist\n  tracks={[]}\n/>'
  }

  const trackList = tracks
    .map((track) => `    '${track.replace(/'/g, "\\'")}',`)
    .join('\n')

  return `<Tracklist
  tracks={[
${trackList}
  ]}
/>`
}

// Main pipeline function with Effect wrapper
const parseTracklist = (
  input: string
): Effect.Effect<string, EmptyInputError, never> =>
  Effect.gen(function* () {
    yield* Effect.logInfo('Starting tracklist parsing pipeline', {
      inputLength: input.length
    })

    if (!input.trim()) {
      yield* Effect.logWarning('Empty input provided')
      return yield* Effect.fail(new EmptyInputError({ input }))
    }

    const format = detectTracklistFormat(input)
    yield* Effect.logDebug('Format detected', { format })

    let tracks: string[] = []

    switch (format) {
      case TracklistFormat.DJ_SOFTWARE_EXPORT:
        tracks = parseDjSoftwareExport(input)
        break
      case TracklistFormat.MARKDOWN_LIST:
        tracks = parseMarkdownList(input)
        break
      case TracklistFormat.PLAIN_TEXT_LIST:
        tracks = parsePlainTextList(input)
        break
      default:
        tracks = []
    }

    const jsx = formatTracksAsJSX(tracks)

    yield* Effect.logInfo('Tracklist parsing pipeline complete', {
      format,
      trackCount: tracks.length,
      outputLength: jsx.length
    })

    return jsx
  })

// Backwards compatible function for current usage
export function extractTracklistAsJSXstring(input: string): string {
  try {
    return pipe(parseTracklist(input), Effect.runSync)
  } catch (error) {
    console.warn('Tracklist parsing failed, returning empty JSX:', error)
    return '<Tracklist\n  tracks={[]}\n/>'
  }
}

// Effect-based version for new code
export const extractTracklistAsJSXEffect = parseTracklist
