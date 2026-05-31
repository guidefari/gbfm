import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Effect } from 'effect'
import { MixProcessingConfig } from './config'
import { MixFileSystemError, MixProcessingError, MixValidationError } from './errors'
import type { MixProcessingInput, ProcessedFiles } from './types'

/**
 * @deprecated This formatting logic is part of the deprecated mix-processing pipeline.
 */
export function formatTracklist(tracklist: string): string {
  return tracklist
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const [number, artist, ...titleParts] = line.split('\t').map((part) => part.trim())
      const title = titleParts.join(' ')
      return `${number}. ${artist} - ${title}`
    })
    .join('\n')
}

/**
 * @deprecated This filesystem staging step is part of the deprecated mix-processing pipeline.
 */
export function writeFilesToDisk(
  input: MixProcessingInput
): Effect.Effect<ProcessedFiles, MixFileSystemError | MixValidationError> {
  return Effect.gen(function* () {
    if (!input.audioBuffer || !input.imageBuffer) {
      return yield* new MixValidationError({
        message: 'Missing required files: audioBuffer and imageBuffer are required'
      })
    }

    const tmpDir = yield* Effect.tryPromise({
      try: () => fs.mkdtemp(path.join(os.tmpdir(), 'mix-')),
      catch: (error) =>
        new MixFileSystemError({
          message: `Failed to create temp directory: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    })

    const audioPath = path.join(tmpDir, 'audio.mp3')
    const imagePath = path.join(tmpDir, 'cover.jpg')
    const outputPath = path.join(tmpDir, `output.${input.outputFormat}`)

    yield* Effect.tryPromise({
      try: () => fs.writeFile(audioPath, input.audioBuffer),
      catch: (error) =>
        new MixFileSystemError({
          message: `Failed to write audio file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          path: audioPath
        })
    })

    yield* Effect.tryPromise({
      try: () => fs.writeFile(imagePath, input.imageBuffer),
      catch: (error) =>
        new MixFileSystemError({
          message: `Failed to write image file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          path: imagePath
        })
    })

    return {
      audioPath,
      imagePath,
      outputPath,
      description: input.description,
      artist: input.artist,
      album: input.album
    }
  })
}

/**
 * @deprecated This FFmpeg orchestration is part of the deprecated mix-processing pipeline.
 */
export function createAudioOrVideo(
  files: ProcessedFiles,
  outputFormat: string
): Effect.Effect<string, MixProcessingError, MixProcessingConfig> {
  return Effect.gen(function* () {
    const config = yield* MixProcessingConfig
    const formattedTracklist = formatTracklist(files.description)

    const ffmpegArgs =
      outputFormat === 'mp3'
        ? [
            '-i',
            files.audioPath,
            '-i',
            config.introAudioPath,
            '-i',
            files.imagePath,
            '-filter_complex',
            '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[a]',
            '-c:a',
            'libmp3lame',
            '-b:a',
            '320k',
            '-map',
            '[a]',
            '-map',
            '2',
            '-c:v',
            'mjpeg',
            '-disposition:v:0',
            'attached_pic',
            '-metadata',
            'TCON=Electronic',
            ...(files.artist ? ['-metadata', `artist=${files.artist}`] : []),
            '-metadata',
            `album=${files.album || 'GBFM'}`,
            '-metadata',
            `description=Tracklist:\\n${formattedTracklist}`,
            '-metadata',
            `comment=Tracklist:\\n${formattedTracklist}`,
            '-metadata',
            `lyrics=Tracklist:\\n${formattedTracklist}`,
            '-metadata',
            `USLT=Tracklist:\\n${formattedTracklist}`,
            '-id3v2_version',
            '3',
            files.outputPath
          ]
        : [
            '-loop',
            '1',
            '-i',
            files.imagePath,
            '-i',
            files.audioPath,
            '-i',
            config.introAudioPath,
            '-filter_complex',
            '[1:a][2:a]amix=inputs=2:duration=first:dropout_transition=2[a]',
            '-c:v',
            'libx264',
            '-tune',
            'stillimage',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-pix_fmt',
            'yuv420p',
            '-shortest',
            '-vf',
            'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
            '-map',
            '0:v',
            '-map',
            '[a]',
            files.outputPath
          ]

    yield* Effect.tryPromise({
      try: async () => {
        const ffmpegProcess = Bun.spawn([config.ffmpegPath, ...ffmpegArgs], {
          stdout: 'pipe',
          stderr: 'pipe'
        })

        const [stderr, exitCode] = await Promise.all([
          new Response(ffmpegProcess.stderr).text(),
          ffmpegProcess.exited
        ])

        if (stderr.trim()) {
          Effect.logInfo('[MixProcessing] FFmpeg processing', {
            output: stderr.trim()
          }).pipe(Effect.runPromise)
        }

        if (exitCode !== 0) {
          throw new Error(`FFmpeg process exited with code ${exitCode}`)
        }
      },
      catch: (error) =>
        new MixProcessingError({
          message: `FFmpeg processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code:
            error instanceof Error &&
            'code' in error &&
            typeof (error as { code?: unknown }).code === 'number'
              ? (error as { code: number }).code
              : undefined
        })
    })

    return files.outputPath
  })
}

/**
 * @deprecated This cleanup helper is part of the deprecated mix-processing pipeline.
 */
export function cleanup(files: ProcessedFiles): Effect.Effect<void> {
  return Effect.gen(function* () {
    yield* Effect.tryPromise(() => fs.unlink(files.audioPath)).pipe(Effect.catch(() => Effect.void))

    yield* Effect.tryPromise(() => fs.unlink(files.imagePath)).pipe(Effect.catch(() => Effect.void))

    yield* Effect.tryPromise(() => fs.unlink(files.outputPath)).pipe(
      Effect.catch(() => Effect.void)
    )

    yield* Effect.tryPromise(() => fs.rmdir(path.dirname(files.audioPath))).pipe(
      Effect.catch(() => Effect.void)
    )
  })
}

/**
 * @deprecated Use the replacement mix-processing seam introduced in a follow-up.
 */
export function processMix(
  input: MixProcessingInput
): Effect.Effect<
  { outputBuffer: Buffer; outputFormat: string; safeTitle: string },
  MixValidationError | MixProcessingError | MixFileSystemError,
  MixProcessingConfig
> {
  return Effect.gen(function* () {
    const safeTitle = input.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const files = yield* writeFilesToDisk(input)

    const result = yield* Effect.gen(function* () {
      const outputPath = yield* createAudioOrVideo(files, input.outputFormat)

      const outputBuffer = yield* Effect.tryPromise({
        try: () => fs.readFile(outputPath),
        catch: (error) =>
          new MixFileSystemError({
            message: `Failed to read output file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            path: outputPath
          })
      })

      return {
        outputBuffer: Buffer.from(outputBuffer),
        outputFormat: input.outputFormat,
        safeTitle
      }
    }).pipe(Effect.ensuring(cleanup(files)))

    return result
  })
}
