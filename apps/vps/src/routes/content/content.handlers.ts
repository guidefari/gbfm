import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { and, arrayContains, count, desc, eq } from 'drizzle-orm'
import ffmpeg from 'ffmpeg-static'
import type { Context } from 'hono'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import {
  audioCreators,
  audioTable,
  type SelectMdxCompiledAudio
} from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
import { postCreators, postsTable } from '@/db/post.schema'
import { timeQuery } from '@/db/query-timer'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import { createPaginationMetadata } from '@/lib/pagination'
import type { AppBindings, AppRouteHandler } from '@/lib/types'

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

  try {
    // Start a transaction since we need to insert into two tables
    const result = await db.transaction(async (tx) => {
      // Insert the post first
      const [newPost] = await tx.insert(postsTable).values(postData).returning()

      if (!newPost) {
        throw new Error('Failed to create post')
      }

      // Insert the post-creator relationships
      await tx.insert(postCreators).values(
        finalCreatorIds.map((creatorId: string) => ({
          postId: newPost.id,
          creatorId
        }))
      )

      return newPost
    })

    return c.json(result, HttpStatusCodes.CREATED)
  } catch (error) {
    console.error('Error creating post:', error)
    return c.json(
      { error: `Failed to create post: ${error}` },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getPostsByTag: AppRouteHandler<GetPostsByTagRoute> = async (c) => {
  const params = c.req.valid('param')
  const tag = params.tag
  const { limit, offset } = c.req.valid('query')

  try {
    const whereCondition = arrayContains(postsTable.tags, [tag])

    // Get total count
    const countResult = await timeQuery(
      () =>
        db.select({ total: count() }).from(postsTable).where(whereCondition),
      'get-posts-by-tag-count'
    )

    const total = countResult[0]?.total ?? 0

    // Get paginated data
    const data = await timeQuery(
      () =>
        db
          .select()
          .from(postsTable)
          .where(whereCondition)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(postsTable.createdAt)),
      'get-posts-by-tag-data'
    )

    return c.json(
      {
        data,
        pagination: createPaginationMetadata(total, limit, offset)
      },
      HttpStatusCodes.OK
    )
  } catch (error) {
    console.error('Error fetching posts by tag:', error)
    return c.json(
      { error: 'Failed to fetch posts' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

// Mix management handlers
export const createMix: AppRouteHandler<CreateMixRoute> = async (c) => {
  const { creatorIds, ...mixData } = c.req.valid('json')
  const user = c.get('user')

  let finalCreatorIds: string[] = creatorIds || []
  if (finalCreatorIds.length === 0) {
    finalCreatorIds = [user.id]
  }

  try {
    const result = await timeQuery(
      () =>
        db.transaction(async (tx) => {
          const [newMix] = await tx
            .insert(audioTable)
            .values(mixData)
            .returning()

          if (!newMix) {
            throw new Error('Failed to create mix')
          }

          await tx.insert(audioCreators).values(
            finalCreatorIds.map((creatorId: string) => ({
              audioId: newMix.id,
              creatorId
            }))
          )

          return newMix
        }),
      'create-mix-transaction'
    )

    return c.json(result, HttpStatusCodes.CREATED)
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return c.json(
        { error: 'Mix with this slug already exists' },
        HttpStatusCodes.CONFLICT
      )
    }

    if (
      error instanceof Error &&
      error.message.includes('foreign key constraint')
    ) {
      return c.json(
        { error: 'You may have entered a non-existent creator id' },
        HttpStatusCodes.CONFLICT
      )
    }

    return c.json(
      { error: `Failed to create mix: ${error}` },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getAudioByType: AppRouteHandler<GetAudioByTypeRoute> = async (
  c
) => {
  const { type } = c.req.valid('param')
  const { limit, offset } = c.req.valid('query')

  try {
    const whereCondition = eq(audioTable.type, type)

    // Get total count
    const countResult = await timeQuery(
      () =>
        db.select({ total: count() }).from(audioTable).where(whereCondition),
      'get-audio-by-type-count'
    )

    const total = countResult[0]?.total ?? 0

    // Get paginated data
    const data = await timeQuery(
      () =>
        db
          .select()
          .from(audioTable)
          .where(whereCondition)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(audioTable.createdAt)),
      'get-audio-by-type-data'
    )

    return c.json(
      {
        data,
        pagination: createPaginationMetadata(total, limit, offset)
      },
      HttpStatusCodes.OK
    )
  } catch (error) {
    console.error('Error fetching audio by type:', error)
    return c.json(
      { error: 'Failed to fetch audio by type' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getAudioBySlug: AppRouteHandler<GetAudioBySlugRoute> = async (
  c
) => {
  const { type, slug } = c.req.valid('param')

  try {
    // First get the audio record
    const [audio] = await db
      .select()
      .from(audioTable)
      .where(and(eq(audioTable.type, type), eq(audioTable.slug, slug)))
      .limit(1)

    if (!audio) {
      return c.json({ error: 'Audio not found' }, HttpStatusCodes.NOT_FOUND)
    }

    // Then get the creators
    const creators = await db
      .select({
        id: usersTable.id,
        name: usersTable.name
      })
      .from(audioCreators)
      .innerJoin(usersTable, eq(audioCreators.creatorId, usersTable.id))
      .where(eq(audioCreators.audioId, audio.id))

    let processedAudio: SelectMdxCompiledAudio = {
      ...audio,
      compiledContent: '',
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name
      }))
    }

    if (audio.content) {
      const mdxResult = await compileMDX(audio.content)

      if (isMDXCompilationResult(mdxResult)) {
        processedAudio = {
          ...processedAudio,
          compiledContent: mdxResult.compiled
        }
      } else {
        // If MDX compilation failed, log the error but still return the audio
        console.warn('Failed to compile MDX for audio:', slug, mdxResult.error)
      }
    }

    return c.json(processedAudio, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Error fetching audio by slug:', error)
    return c.json(
      { error: 'Failed to fetch audio' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const updateAudioBySlug: AppRouteHandler<
  UpdateAudioBySlugRoute
> = async (c) => {
  const { type, slug } = c.req.valid('param')
  const updateData = c.req.valid('json')
  const user = c.get('user')

  try {
    // First check if the audio exists and user is authorized
    const [existingAudio] = await db
      .select()
      .from(audioTable)
      .where(and(eq(audioTable.type, type), eq(audioTable.slug, slug)))
      .limit(1)

    if (!existingAudio) {
      return c.json({ error: 'Audio not found' }, HttpStatusCodes.NOT_FOUND)
    }

    // Check if user is a creator of this content
    const authorship = await db
      .select()
      .from(audioCreators)
      .where(
        and(
          eq(audioCreators.audioId, existingAudio.id),
          eq(audioCreators.creatorId, user.id)
        )
      )
      .limit(1)

    if (authorship.length === 0) {
      return c.json(
        {
          error: 'Forbidden, brethren.'
        },
        HttpStatusCodes.FORBIDDEN
      )
    }

    // Update the audio record
    const [updatedAudio] = await db
      .update(audioTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(audioTable.id, existingAudio.id))
      .returning()

    if (!updatedAudio) {
      return c.json(
        { error: 'Failed to update audio' },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      )
    }

    // Get creators for response
    const creators = await db
      .select({
        id: usersTable.id,
        name: usersTable.name
      })
      .from(audioCreators)
      .innerJoin(usersTable, eq(audioCreators.creatorId, usersTable.id))
      .where(eq(audioCreators.audioId, updatedAudio.id))

    // Compile MDX if content was updated
    const baseProcessedAudio: SelectMdxCompiledAudio = {
      ...updatedAudio,
      compiledContent: '',
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name
      }))
    }

    if (updatedAudio.content) {
      const mdxResult = await compileMDX(updatedAudio.content)
      if (isMDXCompilationResult(mdxResult)) {
        const processedAudioWithCompiled: SelectMdxCompiledAudio = {
          ...baseProcessedAudio,
          compiledContent: mdxResult.compiled
        }
        return c.json(processedAudioWithCompiled, HttpStatusCodes.OK)
      }
    }

    return c.json(baseProcessedAudio, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Error updating audio:', error)
    return c.json(
      { error: 'Failed to update audio' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const createAudio: AppRouteHandler<CreateAudioRoute> = async (c) => {
  const { creatorIds, ...audioData } = c.req.valid('json')
  const user = c.get('user')

  let finalCreatorIds: string[] = creatorIds || []
  if (finalCreatorIds.length === 0) {
    finalCreatorIds = [user.id]
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [newAudio] = await tx
        .insert(audioTable)
        .values(audioData)
        .returning()

      if (!newAudio) {
        throw new Error('Failed to create audio')
      }

      await tx.insert(audioCreators).values(
        finalCreatorIds.map((creatorId: string) => ({
          audioId: newAudio.id,
          creatorId
        }))
      )
      return newAudio
    })
    return c.json(result, HttpStatusCodes.CREATED)
  } catch (error) {
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return c.json(
        { error: 'Audio with this slug already exists' },
        HttpStatusCodes.CONFLICT
      )
    }
    if (
      error instanceof Error &&
      error.message.includes('foreign key constraint')
    ) {
      return c.json(
        { error: 'You may have entered a non-existent creator id' },
        HttpStatusCodes.CONFLICT
      )
    }
    return c.json(
      { error: `Failed to create audio: ${error}` },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
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
