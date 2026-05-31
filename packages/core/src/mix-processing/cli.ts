import fs from 'node:fs/promises'
import path from 'node:path'
import { Effect } from 'effect'
import ffmpeg from 'ffmpeg-static'
import { runMixProcessing } from './run'
import type { MixProcessingInput } from './types'

interface MixCliOptions {
  audio: string
  image: string
  title: string
  description: string
  format: 'mp3' | 'mp4'
  output?: string
  artist?: string
  album?: string
  intro?: string
}

function parseArgs(argv: string[]): MixCliOptions {
  const entries = new Map<string, string>()

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    const value = argv[index + 1]

    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      continue
    }

    entries.set(key.slice(2), value)
    index += 1
  }

  const audio = entries.get('audio')
  const image = entries.get('image')
  const title = entries.get('title')
  const description = entries.get('description')
  const format = entries.get('format')

  if (!audio || !image || !title || !description || !format) {
    throw new Error(
      'Usage: bun run process-mix --audio <path> --image <path> --title <title> --description <tracklist> --format <mp3|mp4> [--artist <name>] [--album <name>] [--output <path>] [--intro <path>]'
    )
  }

  if (format !== 'mp3' && format !== 'mp4') {
    throw new Error('Invalid format, expected mp3 or mp4')
  }

  return {
    audio,
    image,
    title,
    description,
    format,
    output: entries.get('output'),
    artist: entries.get('artist'),
    album: entries.get('album'),
    intro: entries.get('intro')
  }
}

async function buildInput(options: MixCliOptions): Promise<MixProcessingInput> {
  const [audioBuffer, imageBuffer] = await Promise.all([
    fs.readFile(options.audio),
    fs.readFile(options.image)
  ])

  return {
    audioBuffer,
    imageBuffer,
    outputFormat: options.format,
    title: options.title,
    description: options.description,
    artist: options.artist,
    album: options.album
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const input = await buildInput(options)
  const repoRoot = path.resolve(import.meta.dir, '../../../../')
  const introAudioPath = options.intro
    ? path.resolve(options.intro)
    : path.join(repoRoot, 'apps/vps/public/intro.wav')

  const result = await Effect.runPromise(
    runMixProcessing(input, {
      ffmpegPath: ffmpeg || 'ffmpeg',
      introAudioPath
    })
  )

  const outputPath = options.output
    ? path.resolve(options.output)
    : path.resolve(`${result.safeTitle}.${input.outputFormat}`)

  await fs.writeFile(outputPath, result.outputBuffer)
  console.log(outputPath)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
