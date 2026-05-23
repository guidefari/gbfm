import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Effect } from 'effect'
import ffmpeg from 'ffmpeg-static'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { FileSystemError, ProcessingError, ValidationError } from '@/errors'
import type { AppRouteHandler } from '@/lib/types'
import { runEffect } from '@/lib/effect-hono'
import { AppRuntime, runAppFork } from '@/runtime'
import { AudioService } from '@/services/audio.service'
import { MixProcessingService } from '@/services/mix-processing.service'
import { PostService } from '@/services/post.service'
import { QRCodeService } from '@/services/qrcode.service'

import type {
  CreateAudioRoute,
  CreateMixRoute,
  CreatePostRoute,
  GetAudioBySlugRoute,
  GetAudioByTypeRoute,
  GetEditorialPostBySlugRoute,
  GetEditorialPostsRoute,
  GetMicroPostBySlugRoute,
  GetMicroPostsRoute,
  GetMixJobStatusRoute,
  GetMixQRPdfRoute,
  GetPostBySlugRoute,
  GetPostsByTagRoute,
  GetPostsRoute,
  ProcessMixUploadRoute,
  SubmitMixProcessingRoute,
  TrackAudioPlayRoute,
  UpdateAudioBySlugRoute,
  UpdatePostBySlugRoute
} from './content.routes'

export const getPosts: AppRouteHandler<GetPostsRoute> = async (c) => {
  const { limit, offset, type } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getAll({ limit, offset, type })
  })

  return runEffect<GetPostsRoute>(c, program)
}

export const getPostBySlug: AppRouteHandler<GetPostBySlugRoute> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getBySlug(slug)
  })

  return runEffect<GetPostBySlugRoute>(c, program)
}

export const getEditorialPosts: AppRouteHandler<
  GetEditorialPostsRoute
> = async (c) => {
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getEditorials({ limit, offset })
  })

  return runEffect<GetEditorialPostsRoute>(c, program)
}

export const getEditorialPostBySlug: AppRouteHandler<
  GetEditorialPostBySlugRoute
> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getEditorialBySlug(slug)
  })

  return runEffect<GetEditorialPostBySlugRoute>(c, program)
}

export const getMicroPosts: AppRouteHandler<GetMicroPostsRoute> = async (c) => {
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getMicroPosts({ limit, offset })
  })

  return runEffect<GetMicroPostsRoute>(c, program)
}

export const getMicroPostBySlug: AppRouteHandler<
  GetMicroPostBySlugRoute
> = async (c) => {
  const { slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getMicroPostBySlug(slug)
  })

  return runEffect<GetMicroPostBySlugRoute>(c, program)
}

export const createPost: AppRouteHandler<CreatePostRoute> = async (c) => {
  const { creatorIds, ...postData } = c.req.valid('json')
  const user = c.get('user')
  const finalCreatorIds = creatorIds?.length ? creatorIds : [user.id]

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.create(postData, finalCreatorIds)
  })

  return runEffect<CreatePostRoute>(c, program, HttpStatusCodes.CREATED)
}

export const updatePostBySlug: AppRouteHandler<UpdatePostBySlugRoute> = async (
  c
) => {
  const { slug } = c.req.valid('param')
  const updateData = c.req.valid('json')
  const user = c.get('user')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.update(slug, user.id, user.role || 'user', {
      ...updateData
    })
  })

  return runEffect<UpdatePostBySlugRoute>(c, program)
}

export const getPostsByTag: AppRouteHandler<GetPostsByTagRoute> = async (c) => {
  const { tag } = c.req.valid('param')
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const postService = yield* PostService
    return yield* postService.getByTag(tag, { limit, offset })
  })

  return runEffect<GetPostsByTagRoute>(c, program)
}

export const createMix: AppRouteHandler<CreateMixRoute> = async (c) => {
  const { creatorIds, ...mixData } = c.req.valid('json')
  const user = c.get('user')
  const finalCreatorIds = creatorIds?.length ? creatorIds : [user.id]

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.create(mixData, finalCreatorIds)
  })

  return runEffect<CreateMixRoute>(c, program, HttpStatusCodes.CREATED)
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
  }).pipe(Effect.withSpan('getAudioByType'))

  return runEffect<GetAudioByTypeRoute>(c, program)
}

export const getAudioBySlug: AppRouteHandler<GetAudioBySlugRoute> = async (
  c
) => {
  const { type, slug } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.getBySlug(type as 'mix' | 'track' | 'misc', slug)
  }).pipe(Effect.withSpan('getAudioBySlug'))

  return runEffect<GetAudioBySlugRoute>(c, program)
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
  }).pipe(Effect.withSpan('updateAudioBySlug'))

  return runEffect<UpdateAudioBySlugRoute>(c, program)
}

export const createAudio: AppRouteHandler<CreateAudioRoute> = async (c) => {
  const { creatorIds, ...audioData } = c.req.valid('json')
  const user = c.get('user')
  const finalCreatorIds = creatorIds?.length ? creatorIds : [user.id]

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.create(audioData, finalCreatorIds)
  })

  return runEffect<CreateAudioRoute>(c, program, HttpStatusCodes.CREATED)
}

export const trackAudioPlay: AppRouteHandler<TrackAudioPlayRoute> = async (
  c
) => {
  const { id } = c.req.valid('param')
  const clientIp =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'

  const program = Effect.gen(function* () {
    const audioService = yield* AudioService
    return yield* audioService.trackPlay(id, clientIp)
  })

  return runEffect<TrackAudioPlayRoute>(c, program)
}

export const getMixQRPdf: AppRouteHandler<GetMixQRPdfRoute> = async (c) => {
  const { slug } = c.req.valid('param')
  const { force } = c.req.valid('query')

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
      force
    )
  })

  return runEffect<GetMixQRPdfRoute>(c, program)
}

interface ProcessedFiles {
  audioPath: string
  imagePath: string
  outputPath: string
  description: string
  outputFormat: string
  title: string
  artist?: string
  album?: string
}

function processUploadHelper(
  formData: FormData
): Effect.Effect<ProcessedFiles, ValidationError | FileSystemError> {
  return Effect.gen(function* () {
    const tmpDir = yield* Effect.tryPromise({
      try: () => fs.mkdtemp(path.join(os.tmpdir(), 'mix-')),
      catch: (error) =>
        new FileSystemError({
          message: `Failed to create temp directory: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    })

    const audioFile = formData.get('audioFile') as File
    const imageFile = formData.get('coverImage') as File
    const outputFormat = (formData.get('outputFormat') as string) || 'mp4'
    const description = formData.get('description') as string
    const title = formData.get('title') as string
    const artist = formData.get('artist') as string
    const album = formData.get('album') as string

    if (!audioFile || !imageFile) {
      return yield* new ValidationError({
        message: 'Missing required files: audioFile and coverImage are required'
      })
    }

    const audioBuffer = yield* Effect.tryPromise({
      try: () => audioFile.arrayBuffer(),
      catch: (error) =>
        new FileSystemError({
          message: `Failed to read audio file: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    })

    const imageBuffer = yield* Effect.tryPromise({
      try: () => imageFile.arrayBuffer(),
      catch: (error) =>
        new FileSystemError({
          message: `Failed to read image file: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    })

    const audioPath = path.join(tmpDir, 'audio.mp3')
    const imagePath = path.join(tmpDir, 'cover.jpg')
    const outputPath = path.join(tmpDir, `output.${outputFormat}`)

    yield* Effect.tryPromise({
      try: () => fs.writeFile(audioPath, Buffer.from(audioBuffer)),
      catch: (error) =>
        new FileSystemError({
          message: `Failed to write audio file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          path: audioPath
        })
    })

    yield* Effect.tryPromise({
      try: () => fs.writeFile(imagePath, Buffer.from(imageBuffer)),
      catch: (error) =>
        new FileSystemError({
          message: `Failed to write image file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          path: imagePath
        })
    })

    return {
      audioPath,
      imagePath,
      outputPath,
      description,
      outputFormat,
      title,
      artist,
      album
    }
  })
}

export const processUpload: AppRouteHandler<ProcessMixUploadRoute> = async (
  c
) => {
  const user = c.get('user')

  Effect.logInfo('[Content] File processing started', {
    userId: user.id,
    email: user.email
  }).pipe(runAppFork)

  const formData = await c.req.formData()

  const program = Effect.gen(function* () {
    const files = yield* processUploadHelper(formData)
    const { outputFormat, title } = files
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const outputPath = yield* createAudioOrVideo(files, outputFormat)
    const outputBuffer = yield* Effect.tryPromise({
      try: () => fs.readFile(outputPath),
      catch: (error) =>
        new FileSystemError({
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

  Effect.logInfo('[Content] File processing completed successfully', {
    userId: user.id,
    title: result.safeTitle,
    outputFormat: result.outputFormat,
    outputSize: result.outputBuffer.length
  }).pipe(runAppFork)

  return new Response(result.outputBuffer, {
    headers: {
      'Content-Type':
        result.outputFormat === 'mp3' ? 'audio/mpeg' : 'video/mp4',
      'Content-Disposition': `attachment; filename="${result.safeTitle}.${result.outputFormat}"`
    }
  })
}

export const submitMixProcessing: AppRouteHandler<
  SubmitMixProcessingRoute
> = async (c) => {
  const user = c.get('user')
  const formData = await c.req.formData()

  const program = Effect.gen(function* () {
    const audioFile = formData.get('audioFile') as File
    const imageFile = formData.get('coverImage') as File
    const outputFormat = (formData.get('outputFormat') as string) || 'mp4'
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const artist = formData.get('artist') as string
    const album = formData.get('album') as string

    if (!audioFile || !imageFile) {
      return yield* new ValidationError({
        message: 'Missing required files: audioFile and coverImage are required'
      })
    }

    const audioBuffer = yield* Effect.tryPromise({
      try: () => audioFile.arrayBuffer().then((ab) => Buffer.from(ab)),
      catch: (error) =>
        new FileSystemError({
          message: `Failed to read audio file: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    })

    const imageBuffer = yield* Effect.tryPromise({
      try: () => imageFile.arrayBuffer().then((ab) => Buffer.from(ab)),
      catch: (error) =>
        new FileSystemError({
          message: `Failed to read image file: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
    })

    const jobId = crypto.randomUUID()
    const mixProcessing = yield* MixProcessingService
    yield* mixProcessing.submitJob(jobId, {
      audioBuffer,
      imageBuffer,
      outputFormat: outputFormat as 'mp3' | 'mp4',
      title,
      description,
      artist,
      album
    })

    yield* Effect.logInfo('[Content] Mix processing job submitted', {
      jobId,
      userId: user.id,
      title
    })

    return { jobId, status: 'Queued' as const }
  }).pipe(
    Effect.catchTag('ValidationError', (error) =>
      Effect.succeed({
        error: error.message,
        status: HttpStatusCodes.BAD_REQUEST
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

  return c.json(result, HttpStatusCodes.ACCEPTED)
}

export const getMixJobStatus: AppRouteHandler<GetMixJobStatusRoute> = async (
  c
) => {
  const { jobId } = c.req.valid('param')

  const program = Effect.gen(function* () {
    const mixProcessing = yield* MixProcessingService
    return yield* mixProcessing.getJobStatus(jobId)
  })

  const result = await AppRuntime.runPromise(program)

  if (!result) {
    return c.json({ error: 'Job not found' }, HttpStatusCodes.NOT_FOUND)
  }

  return c.json(result, HttpStatusCodes.OK)
}

function formatTracklist(tracklist: string): string {
  return tracklist
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const [number, artist, ...titleParts] = line
        .split('\t')
        .map((part) => part.trim())
      return `${number}. ${artist} - ${titleParts.join(' ')}`
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
      try: async () => {
        const ffmpegProcess = Bun.spawn([ffmpeg as string, ...ffmpegArgs], {
          stdout: 'pipe',
          stderr: 'pipe'
        })
        const [stderr, exitCode] = await Promise.all([
          new Response(ffmpegProcess.stderr).text(),
          ffmpegProcess.exited
        ])
        if (stderr.trim()) {
          Effect.logInfo('[Content] FFmpeg processing', {
            output: stderr.trim()
          }).pipe(runAppFork)
        }
        if (exitCode !== 0) {
          throw new Error(`FFmpeg process exited with code ${exitCode}`)
        }
      },
      catch: (error) =>
        new ProcessingError({
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
      Effect.catch(() => Effect.void)
    )
    yield* Effect.tryPromise(() => fs.unlink(files.imagePath)).pipe(
      Effect.catch(() => Effect.void)
    )
    yield* Effect.tryPromise(() => fs.unlink(files.outputPath)).pipe(
      Effect.catch(() => Effect.void)
    )
    yield* Effect.tryPromise(() =>
      fs.rmdir(path.dirname(files.audioPath))
    ).pipe(Effect.catch(() => Effect.void))
  })
}
