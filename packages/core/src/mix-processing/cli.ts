import fs from 'node:fs/promises'
import path from 'node:path'
import { Effect } from 'effect'
import ffmpeg from 'ffmpeg-static'
import { toSafeMixTitle } from './jobs'
import { runMixProcessing } from './run'
import type { MixProcessingInput, MixProcessingJobFile } from './types'

interface MixCliOptions {
  jobPath: string
}

function parseArgs(argv: string[]): MixCliOptions {
  if (argv.length === 1 && argv[0] && !argv[0].startsWith('-')) {
    return { jobPath: argv[0] }
  }

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    const value = argv[index + 1]

    if ((key === '--job' || key === '-j') && value && !value.startsWith('-')) {
      return { jobPath: value }
    }
  }

  throw new Error('Usage: bun run process-mix --job <path-to-job.json>')
}

function readRequiredString(value: unknown, fieldName: keyof MixProcessingJobFile): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Job file is missing required string field: ${fieldName}`)
  }

  return value
}

function readOptionalString(
  value: unknown,
  fieldName: keyof MixProcessingJobFile
): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Job file field must be a non-empty string: ${fieldName}`)
  }

  return value
}

function parseJobFile(raw: unknown): MixProcessingJobFile {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Job file must contain a JSON object')
  }

  const audioPath = readRequiredString(Reflect.get(raw, 'audioPath'), 'audioPath')
  const imagePath = readRequiredString(Reflect.get(raw, 'imagePath'), 'imagePath')
  const title = readRequiredString(Reflect.get(raw, 'title'), 'title')
  const description = readRequiredString(Reflect.get(raw, 'description'), 'description')
  const outputFormat = readRequiredString(Reflect.get(raw, 'outputFormat'), 'outputFormat')

  if (outputFormat !== 'mp3' && outputFormat !== 'mp4') {
    throw new Error('Job file outputFormat must be mp3 or mp4')
  }

  const outputPath = readOptionalString(Reflect.get(raw, 'outputPath'), 'outputPath')
  const artist = readOptionalString(Reflect.get(raw, 'artist'), 'artist')
  const album = readOptionalString(Reflect.get(raw, 'album'), 'album')
  const introAudioPath = readOptionalString(Reflect.get(raw, 'introAudioPath'), 'introAudioPath')

  return {
    audioPath,
    imagePath,
    outputFormat,
    title,
    description,
    ...(outputPath ? { outputPath } : {}),
    ...(artist ? { artist } : {}),
    ...(album ? { album } : {}),
    ...(introAudioPath ? { introAudioPath } : {})
  }
}

async function readJobFile(jobPath: string) {
  const resolvedJobPath = path.resolve(jobPath)
  const raw = await fs.readFile(resolvedJobPath, 'utf8')
  const job = parseJobFile(JSON.parse(raw))

  return {
    job,
    jobDir: path.dirname(resolvedJobPath)
  }
}

function resolveJobPaths(job: MixProcessingJobFile, jobDir: string): MixProcessingJobFile {
  const outputPath = job.outputPath
    ? path.resolve(jobDir, job.outputPath)
    : path.resolve(jobDir, `${toSafeMixTitle(job.title)}.${job.outputFormat}`)

  return {
    ...job,
    audioPath: path.resolve(jobDir, job.audioPath),
    imagePath: path.resolve(jobDir, job.imagePath),
    outputPath,
    ...(job.introAudioPath ? { introAudioPath: path.resolve(jobDir, job.introAudioPath) } : {})
  }
}

async function buildInput(job: MixProcessingJobFile): Promise<MixProcessingInput> {
  const [audioBuffer, imageBuffer] = await Promise.all([
    fs.readFile(job.audioPath),
    fs.readFile(job.imagePath)
  ])

  return {
    audioBuffer,
    imageBuffer,
    outputFormat: job.outputFormat,
    title: job.title,
    description: job.description,
    ...(job.artist ? { artist: job.artist } : {}),
    ...(job.album ? { album: job.album } : {})
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const { job, jobDir } = await readJobFile(options.jobPath)
  const resolvedJob = resolveJobPaths(job, jobDir)
  const input = await buildInput(resolvedJob)
  const repoRoot = path.resolve(import.meta.dir, '../../../../')
  const introAudioPath = resolvedJob.introAudioPath
    ? resolvedJob.introAudioPath
    : path.join(repoRoot, 'apps/vps/public/intro.wav')

  const result = await Effect.runPromise(
    runMixProcessing(input, {
      ffmpegPath: ffmpeg || 'ffmpeg',
      introAudioPath
    })
  )

  const outputPath =
    resolvedJob.outputPath ?? path.resolve(jobDir, `${result.safeTitle}.${input.outputFormat}`)

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, result.outputBuffer)
  console.log(outputPath)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
