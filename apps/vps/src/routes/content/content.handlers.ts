import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Effect } from 'effect'
import ffmpeg from 'ffmpeg-static'
import type { Context } from 'hono'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppBindings, AppRouteHandler } from '@/lib/types'
import { AppRuntime } from '@/runtime'
import { AudioService } from '@/services/audio.service'
import { PostService } from '@/services/post.service'

import type {
  CreateAudioRoute,
  CreateMixRoute,
  CreatePostRoute,
  GetAudioBySlugRoute,
  GetAudioByTypeRoute,
  GetPostsByTagRoute,
  ProcessMixUploadRoute,
  UpdateAudioBySlugRoute
} from './content.routes'

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

  const result = await AppRuntime.runPromise(program)

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

  const result = await AppRuntime.runPromise(program)

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

  const result = await AppRuntime.runPromise(program)

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
async function processUploadHelper(
  c: Context<AppBindings>
): Promise<ProcessedFiles> {
  const formData = await c.req.formData()
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mix-'))

  const audioFile = formData.get('audioFile') as File
  const imageFile = formData.get('coverImage') as File
  const outputFormat = formData.get('outputFormat') as string
  const description = formData.get('description') as string
  const artist = formData.get('artist') as string
  const album = formData.get('album') as string
  if (!audioFile || !imageFile) {
    throw new Error('Missing required files')
  }

  const audioBuffer = await audioFile.arrayBuffer()
  const imageBuffer = await imageFile.arrayBuffer()

  const audioPath = path.join(tmpDir, 'audio.mp3')
  const imagePath = path.join(tmpDir, 'cover.jpg')
  const outputPath = path.join(tmpDir, `output.${outputFormat}`)

  await fs.writeFile(audioPath, Buffer.from(audioBuffer))
  await fs.writeFile(imagePath, Buffer.from(imageBuffer))

  return { audioPath, imagePath, outputPath, description, artist, album }
}

export const processUpload: AppRouteHandler<ProcessMixUploadRoute> = async (
  c
) => {
  try {
    const formData = await c.req.formData()
    const files = await processUploadHelper(c)
    const outputFormat = (formData.get('outputFormat') as string) || 'mp4'
    const title = formData.get('title') as string // <-- fix: extract title
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase()

    const outputPath = await createAudioOrVideo(files, outputFormat)
    const outputBuffer = await fs.readFile(outputPath)

    await cleanup(files)

    return new Response(outputBuffer, {
      headers: {
        'Content-Type': outputFormat === 'mp3' ? 'audio/mpeg' : 'video/mp4',
        'Content-Disposition': `attachment; filename="${safeTitle}.${outputFormat}"`
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, HttpStatusCodes.BAD_REQUEST)
    }
    return c.json(
      { error: 'Failed to process upload' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
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

async function createAudioOrVideo(
  files: ProcessedFiles,
  outputFormat: string
): Promise<string> {
  const formattedTracklist = formatTracklist(files.description)

  return new Promise((resolve, reject) => {
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
            `description=Tracklist:\n${formattedTracklist}`,
            '-metadata',
            `comment=Tracklist:\n${formattedTracklist}`,
            '-metadata',
            `lyrics=Tracklist:\n${formattedTracklist}`,
            '-metadata',
            `USLT=Tracklist:\n${formattedTracklist}`,
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

    const ffmpegProcess = spawn(ffmpeg as string, ffmpegArgs)

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve(files.outputPath)
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}`))
      }
    })

    ffmpegProcess.stderr.on('data', (data) => {
      console.log(`FFmpeg: ${data}`)
    })
  })
}

async function cleanup(files: ProcessedFiles) {
  try {
    await fs.unlink(files.audioPath)
    await fs.unlink(files.imagePath)
    await fs.unlink(files.outputPath)
    await fs.rmdir(path.dirname(files.audioPath))
  } catch (error) {
    console.error('Cleanup error:', error)
  }
}
