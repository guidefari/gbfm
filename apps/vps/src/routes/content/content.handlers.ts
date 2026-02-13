import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Effect, Schema } from 'effect'
import ffmpeg from 'ffmpeg-static'
import type { Context } from 'hono'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppBindings, AppRouteHandler } from '@/lib/types'
import { AppRuntime } from '@/runtime'
import { AudioService } from '@/services/audio.service'
import { PostService } from '@/services/post.service'
import { QRCodeService } from '@/services/qrcode.service'

import type {
  CreateAudioRoute,
  CreateMixRoute,
  CreatePostRoute,
  GetAudioBySlugRoute,
  GetAudioByTypeRoute,
  GetMixQRPdfRoute,
  GetPostBySlugRoute,
  GetPostsByTagRoute,
  GetPostsRoute,
  ProcessMixUploadRoute,
  UpdateAudioBySlugRoute
} from './content.routes'

// Error types for upload processing
class ValidationError extends Schema.TaggedError<ValidationError>()(
  'ValidationError',
  {
    message: Schema.String
  }
) {}

class ProcessingError extends Schema.TaggedError<ProcessingError>()(
  'ProcessingError',
  {
    message: Schema.String,
    code: Schema.optional(Schema.Number)
  }
) {}

class FileSystemError extends Schema.TaggedError<FileSystemError>()(
  'FileSystemError',
  {
    message: Schema.String,
    path: Schema.optional(Schema.String)
  }
) {}

export const getPosts: AppRouteHandler<GetPostsRoute> = async (c) => {
  const { limit, offset, type } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getAll({ limit, offset, type })
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

export const getPostBySlug: AppRouteHandler<GetPostBySlugRoute> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getBySlug(slug)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

export const createPost: AppRouteHandler<CreatePostRoute> = async (c) => {
  const { creatorIds, ...postData } = c.req.valid('json')
  const user = c.get('user')

  let finalCreatorIds: string[] = creatorIds || []
  if (finalCreatorIds.length === 0) {
    finalCreatorIds = [user.id]
  }

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.create(postData, finalCreatorIds)
  }).pipe(
    Effect.catchTag('ConflictError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.CREATED)
}

export const getPostsByTag: AppRouteHandler<GetPostsByTagRoute> = async (c) => {
  const params = c.req.valid('param')
  const tag = params.tag
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getByTag(tag, { limit, offset })
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

// Mix management handlers
export const createMix: AppRouteHandler<CreateMixRoute> = async (c) => {
  const { creatorIds, ...mixData } = c.req.valid('json')
  const user = c.get('user')

  let finalCreatorIds: string[] = creatorIds || []
  if (finalCreatorIds.length === 0) {
    finalCreatorIds = [user.id]
  }

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.create(mixData, finalCreatorIds)
  }).pipe(
    Effect.catchTag('ConflictError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.CREATED)
}

export const getAudioByType: AppRouteHandler<GetAudioByTypeRoute> = async (
  c
) => {
  const { type } = c.req.valid('param')
  const { limit, offset, tag } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.getByType(type as 'mix' | 'track' | 'misc', {
      limit,
      offset,
      tag
    })
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const instrumented = program.pipe(Effect.withSpan('getAudioByType'))

  const result = await AppRuntime.runPromise(instrumented)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

export const getAudioBySlug: AppRouteHandler<GetAudioBySlugRoute> = async (
  c
) => {
  const { type, slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.getBySlug(type as 'mix' | 'track' | 'misc', slug)
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const instrumented = program.pipe(Effect.withSpan('getAudioBySlug'))

  const result = await AppRuntime.runPromise(instrumented)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

export const updateAudioBySlug: AppRouteHandler<
  UpdateAudioBySlugRoute
> = async (c) => {
  const { type, slug } = c.req.valid('param')
  const updateData = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.update(
      type as 'mix' | 'track' | 'misc',
      slug,
      user.id,
      user.role || 'user',
      updateData
    )
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('UnauthorizedError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.FORBIDDEN
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const instrumented = program.pipe(Effect.withSpan('updateAudioBySlug'))

  const result = await AppRuntime.runPromise(instrumented)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}

export const createAudio: AppRouteHandler<CreateAudioRoute> = async (c) => {
  const { creatorIds, ...audioData } = c.req.valid('json')
  const user = c.get('user')

  let finalCreatorIds: string[] = creatorIds || []
  if (finalCreatorIds.length === 0) {
    finalCreatorIds = [user.id]
  }

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.create(audioData, finalCreatorIds)
  }).pipe(
    Effect.catchTag('ConflictError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.CREATED)
}

interface ProcessedFiles {
  audioPath: string
  imagePath: string
  outputPath: string
  description: string
  artist?: string
  album?: string
}

// Private helper, not exported
function processUploadHelper(
  c: Context<AppBindings>
): Effect.Effect<ProcessedFiles, ValidationError | FileSystemError> {
  return Effect.gen(function* () {
    const formData = yield* Effect.tryPromise({
      try: () => c.req.formData(),
      catch: (error) =>
        FileSystemError.make({
          message: `Failed to parse form data: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    })

    const tmpDir = yield* Effect.tryPromise({
      try: () => fs.mkdtemp(path.join(os.tmpdir(), 'mix-')),
      catch: (error) =>
        FileSystemError.make({
          message: `Failed to create temp directory: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    })

    const audioFile = formData.get('audioFile') as File
    const imageFile = formData.get('coverImage') as File
    const outputFormat = formData.get('outputFormat') as string
    const description = formData.get('description') as string
    const artist = formData.get('artist') as string
    const album = formData.get('album') as string

    if (!audioFile || !imageFile) {
      return yield* ValidationError.make({
        message: 'Missing required files: audioFile and coverImage are required'
      })
    }

    const audioBuffer = yield* Effect.tryPromise({
      try: () => audioFile.arrayBuffer(),
      catch: (error) =>
        FileSystemError.make({
          message: `Failed to read audio file: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    })

    const imageBuffer = yield* Effect.tryPromise({
      try: () => imageFile.arrayBuffer(),
      catch: (error) =>
        FileSystemError.make({
          message: `Failed to read image file: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    })

    const audioPath = path.join(tmpDir, 'audio.mp3')
    const imagePath = path.join(tmpDir, 'cover.jpg')
    const outputPath = path.join(tmpDir, `output.${outputFormat}`)

    yield* Effect.tryPromise({
      try: () => fs.writeFile(audioPath, Buffer.from(audioBuffer)),
      catch: (error) =>
        FileSystemError.make({
          message: `Failed to write audio file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          path: audioPath
        })
    })

    yield* Effect.tryPromise({
      try: () => fs.writeFile(imagePath, Buffer.from(imageBuffer)),
      catch: (error) =>
        FileSystemError.make({
          message: `Failed to write image file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          path: imagePath
        })
    })

    return { audioPath, imagePath, outputPath, description, artist, album }
  })
}

export const processUpload: AppRouteHandler<ProcessMixUploadRoute> = async (
  c
) => {
  const user = c.get('user')

  Effect.logInfo('[Content] File processing started', {
    userId: user.id,
    email: user.email
  }).pipe(Effect.runPromise)

  const program = Effect.gen(function* () {
    const formData = yield* Effect.tryPromise({
      try: () => c.req.formData(),
      catch: (error) =>
        FileSystemError.make({
          message: `Failed to parse form data: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    })

    const files = yield* processUploadHelper(c)
    const outputFormat = (formData.get('outputFormat') as string) || 'mp4'
    const title = formData.get('title') as string

    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase()

    const outputPath = yield* createAudioOrVideo(files, outputFormat)
    const outputBuffer = yield* Effect.tryPromise({
      try: () => fs.readFile(outputPath),
      catch: (error) =>
        FileSystemError.make({
          message: `Failed to read output file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          path: outputPath
        })
    })

    yield* cleanup(files)

    return { outputBuffer, outputFormat, safeTitle }
  }).pipe(
    Effect.catchTag('ValidationError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.BAD_REQUEST
      } as const)
    ),
    Effect.catchTag('ProcessingError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    ),
    Effect.catchTag('FileSystemError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  // Return file response for successful processing
  Effect.logInfo('[Content] File processing completed successfully', {
    userId: user.id,
    title: result.safeTitle,
    outputFormat: result.outputFormat,
    outputSize: result.outputBuffer.length
  }).pipe(Effect.runPromise)

  return new Response(result.outputBuffer, {
    headers: {
      'Content-Type':
        result.outputFormat === 'mp3' ? 'audio/mpeg' : 'video/mp4',
      'Content-Disposition': `attachment; filename="${result.safeTitle}.${result.outputFormat}"`
    }
  })
}

function formatTracklist(tracklist: string): string {
  return tracklist
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#')) // Skip header and empty lines
    .map((line) => {
      const [number, artist, ...titleParts] = line
        .split('\t')
        .map((part) => part.trim())
      const title = titleParts.join(' ') // Rejoin title parts in case they contain tabs
      return `${number}. ${artist} - ${title}`
    })
    .join('\n')
}

function createAudioOrVideo(
  files: ProcessedFiles,
  outputFormat: string
): Effect.Effect<string, ProcessingError> {
  return Effect.gen(function* () {
    const formattedTracklist = formatTracklist(files.description)

    const ffmpegArgs =
      outputFormat === 'mp3'
        ? [
            '-i',
            files.audioPath,
            '-i',
            'public/intro.wav',
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
            'public/intro.wav',
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
      try: () =>
        new Promise<void>((resolve, reject) => {
          const ffmpegProcess = spawn(ffmpeg as string, ffmpegArgs)

          ffmpegProcess.on('close', (code) => {
            if (code === 0) {
              resolve()
            } else {
              reject(new Error(`FFmpeg process exited with code ${code}`))
            }
          })

          ffmpegProcess.on('error', (error) => {
            reject(error)
          })

          ffmpegProcess.stderr.on('data', (data) => {
            Effect.logInfo('[Content] FFmpeg processing', {
              output: data.toString().trim()
            }).pipe(Effect.runPromise)
          })
        }),
      catch: (error) =>
        ProcessingError.make({
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

function cleanup(files: ProcessedFiles): Effect.Effect<void> {
  return Effect.gen(function* () {
    yield* Effect.tryPromise(() => fs.unlink(files.audioPath)).pipe(
      Effect.catchAll(() => Effect.void)
    )

    yield* Effect.tryPromise(() => fs.unlink(files.imagePath)).pipe(
      Effect.catchAll(() => Effect.void)
    )

    yield* Effect.tryPromise(() => fs.unlink(files.outputPath)).pipe(
      Effect.catchAll(() => Effect.void)
    )

    yield* Effect.tryPromise(() =>
      fs.rmdir(path.dirname(files.audioPath))
    ).pipe(Effect.catchAll(() => Effect.void))
  })
}

export const getMixQRPdf: AppRouteHandler<GetMixQRPdfRoute> = async (c) => {
  const { slug } = c.req.valid('param')
  const { template } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    const qrService = yield* QRCodeService

    const mix = yield* audioService.getBySlug('mix', slug)

    return yield* qrService.generateMixQRPdf(
      {
        slug: mix.slug,
        title: mix.title,
        thumbnailUrl: mix.thumbnailUrl,
        creators: mix.creators
      },
      template
    )
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: 404 as const
      })
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: 500 as const
      })
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.OK)
}
