import fs from 'node:fs'
import { PassThrough } from 'node:stream'
import { Effect } from 'effect'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { MixProcessingConfig } from './config'
import { createAudioOrVideo, processMix } from './processing'
import type { ProcessedFiles } from './types'

vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}))

import { spawn } from 'node:child_process'

const spawnMock = vi.mocked(spawn)

function makeFiles(format: 'mp3' | 'mp4'): ProcessedFiles {
  return {
    audioPath: '/tmp/audio.mp3',
    imagePath: '/tmp/cover.jpg',
    outputPath: `/tmp/output.${format}`,
    description: '01\tArtist\tTrack',
    artist: 'Artist',
    album: 'Album'
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('createAudioOrVideo', () => {
  test('uses expected ffmpeg arguments for mp3 output', async () => {
    spawnMock.mockImplementation((_cmd, _args) => {
      const proc = new PassThrough() as unknown as {
        on: (event: string, cb: (...args: unknown[]) => void) => void
        emit: (event: string, ...args: unknown[]) => void
        stderr: PassThrough
      }
      const listeners = new Map<string, (...args: unknown[]) => void>()
      proc.stderr = new PassThrough()
      proc.on = (event, cb) => {
        listeners.set(event, cb)
      }
      proc.emit = (event, ...args) => {
        listeners.get(event)?.(...args)
      }

      queueMicrotask(() => proc.emit('close', 0))
      return proc as unknown as ReturnType<typeof spawn>
    })

    const files = makeFiles('mp3')
    const output = await Effect.runPromise(
      createAudioOrVideo(files, 'mp3').pipe(
        Effect.provideService(MixProcessingConfig, {
          ffmpegPath: '/usr/bin/ffmpeg',
          introAudioPath: '/tmp/intro.mp3'
        })
      )
    )

    expect(output).toBe(files.outputPath)
    const args = spawnMock.mock.calls[0]?.[1] as string[]
    expect(args).toContain('libmp3lame')
    expect(args).toContain('-id3v2_version')
    expect(args).toContain('3')
    expect(args).toContain(`album=${files.album}`)
    expect(args.at(-1)).toBe(files.outputPath)
  })

  test('uses expected ffmpeg arguments for mp4 output', async () => {
    spawnMock.mockImplementation((_cmd, _args) => {
      const proc = new PassThrough() as unknown as {
        on: (event: string, cb: (...args: unknown[]) => void) => void
        emit: (event: string, ...args: unknown[]) => void
        stderr: PassThrough
      }
      const listeners = new Map<string, (...args: unknown[]) => void>()
      proc.stderr = new PassThrough()
      proc.on = (event, cb) => {
        listeners.set(event, cb)
      }
      proc.emit = (event, ...args) => {
        listeners.get(event)?.(...args)
      }

      queueMicrotask(() => proc.emit('close', 0))
      return proc as unknown as ReturnType<typeof spawn>
    })

    const files = makeFiles('mp4')
    await Effect.runPromise(
      createAudioOrVideo(files, 'mp4').pipe(
        Effect.provideService(MixProcessingConfig, {
          ffmpegPath: '/usr/bin/ffmpeg',
          introAudioPath: '/tmp/intro.mp3'
        })
      )
    )

    const args = spawnMock.mock.calls[0]?.[1] as string[]
    expect(args).toContain('-loop')
    expect(args).toContain('libx264')
    expect(args).toContain('-shortest')
    expect(args.at(-1)).toBe(files.outputPath)
  })

  test('maps non-zero ffmpeg exit to MixProcessingError', async () => {
    spawnMock.mockImplementation((_cmd, _args) => {
      const proc = new PassThrough() as unknown as {
        on: (event: string, cb: (...args: unknown[]) => void) => void
        emit: (event: string, ...args: unknown[]) => void
        stderr: PassThrough
      }
      const listeners = new Map<string, (...args: unknown[]) => void>()
      proc.stderr = new PassThrough()
      proc.on = (event, cb) => {
        listeners.set(event, cb)
      }
      proc.emit = (event, ...args) => {
        listeners.get(event)?.(...args)
      }

      queueMicrotask(() => proc.emit('close', 1))
      return proc as unknown as ReturnType<typeof spawn>
    })

    await expect(
      Effect.runPromise(
        createAudioOrVideo(makeFiles('mp3'), 'mp3').pipe(
          Effect.provideService(MixProcessingConfig, {
            ffmpegPath: '/usr/bin/ffmpeg',
            introAudioPath: '/tmp/intro.mp3'
          })
        )
      )
    ).rejects.toThrow('FFmpeg processing failed')
  })
})

describe('processMix', () => {
  test('returns generated output and safe title', async () => {
    spawnMock.mockImplementation((_cmd, args) => {
      const proc = new PassThrough() as unknown as {
        on: (event: string, cb: (...args: unknown[]) => void) => void
        emit: (event: string, ...args: unknown[]) => void
        stderr: PassThrough
      }
      const listeners = new Map<string, (...args: unknown[]) => void>()
      proc.stderr = new PassThrough()
      proc.on = (event, cb) => {
        listeners.set(event, cb)
      }
      proc.emit = (event, ...emitArgs) => {
        listeners.get(event)?.(...emitArgs)
      }

      const outputPath = (args as string[]).at(-1)
      if (outputPath) {
        fs.writeFileSync(outputPath, Buffer.from('encoded-output'))
      }
      queueMicrotask(() => proc.emit('close', 0))
      return proc as unknown as ReturnType<typeof spawn>
    })

    const result = await Effect.runPromise(
      processMix({
        audioBuffer: Buffer.from('audio'),
        imageBuffer: Buffer.from('image'),
        outputFormat: 'mp3',
        title: 'My Great Mix #1',
        description: '01\tArtist\tTrack'
      }).pipe(
        Effect.provideService(MixProcessingConfig, {
          ffmpegPath: '/usr/bin/ffmpeg',
          introAudioPath: '/tmp/intro.mp3'
        })
      )
    )

    expect(result.outputFormat).toBe('mp3')
    expect(result.safeTitle).toBe('my_great_mix__1')
    expect(Buffer.isBuffer(result.outputBuffer)).toBe(true)
    expect(result.outputBuffer.toString()).toBe('encoded-output')
  })

  test('propagates validation errors for missing input files', async () => {
    await expect(
      Effect.runPromise(
        processMix({
          audioBuffer: undefined as unknown as Buffer,
          imageBuffer: Buffer.from('image'),
          outputFormat: 'mp3',
          title: 'mix',
          description: 'desc'
        }).pipe(
          Effect.provideService(MixProcessingConfig, {
            ffmpegPath: '/usr/bin/ffmpeg',
            introAudioPath: '/tmp/intro.mp3'
          })
        )
      )
    ).rejects.toThrow('Missing required files')
  })
})
