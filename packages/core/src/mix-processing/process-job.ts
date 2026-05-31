import fs from 'node:fs/promises'
import path from 'node:path'
import { Effect } from 'effect'
import ffmpeg from 'ffmpeg-static'
import { readMixJob, writeMixJob } from './jobs'
import { runMixProcessing } from './run'
import type { MixProcessingInput } from './types'

interface MixJobCliOptions {
  jobFile: string
  audio: string
  image: string
  title: string
  description: string
  format: 'mp3' | 'mp4'
  output: string
  artist?: string
  album?: string
  intro?: string
}

function parseArgs(argv: string[]): MixJobCliOptions {
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

  const jobFile = entries.get('job-file')
  const audio = entries.get('audio')
  const image = entries.get('image')
  const title = entries.get('title')
  const description = entries.get('description')
  const format = entries.get('format')
  const output = entries.get('output')

  if (
    !jobFile ||
    !audio ||
    !image ||
    !title ||
    !description ||
    !format ||
    !output
  ) {
    throw new Error(
      'Usage: bun run process-mix-job --job-file <path> --audio <path> --image <path> --title <title> --description <tracklist> --format <mp3|mp4> --output <path> [--artist <name>] [--album <name>] [--intro <path>]'
    )
  }

  if (format !== 'mp3' && format !== 'mp4') {
    throw new Error('Invalid format, expected mp3 or mp4')
  }

  return {
    jobFile,
    audio,
    image,
    title,
    description,
    format,
    output,
    artist: entries.get('artist'),
    album: entries.get('album'),
    intro: entries.get('intro')
  }
}

async function buildInput(
  options: MixJobCliOptions
): Promise<MixProcessingInput> {
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
  const job = await readMixJob(options.jobFile)
  const input = await buildInput(options)
  const repoRoot = path.resolve(import.meta.dir, '../../../../')
  const introAudioPath = options.intro
    ? path.resolve(options.intro)
    : path.join(repoRoot, 'apps/vps/public/intro.wav')

  await writeMixJob({
    ...job,
    status: 'processing',
    pid: process.pid,
    updatedAt: Date.now(),
    error: undefined
  })

  try {
    const result = await Effect.runPromise(
      runMixProcessing(input, {
        ffmpegPath: ffmpeg || 'ffmpeg',
        introAudioPath
      })
    )

    await fs.writeFile(options.output, result.outputBuffer)

    await writeMixJob({
      ...job,
      status: 'completed',
      pid: process.pid,
      outputPath: options.output,
      updatedAt: Date.now(),
      error: undefined
    })

    console.log(options.output)
  } catch (error) {
    await writeMixJob({
      ...job,
      status: 'failed',
      pid: process.pid,
      updatedAt: Date.now(),
      error: error instanceof Error ? error.message : String(error)
    })
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
