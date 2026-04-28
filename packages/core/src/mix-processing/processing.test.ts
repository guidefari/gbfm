import fs from 'node:fs'
import { Effect } from 'effect'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { MixProcessingConfig } from './config'
import { createAudioOrVideo, processMix } from './processing'
import type { ProcessedFiles } from './types'

const spawnMock = vi.fn()

vi.stubGlobal('Bun', {
  spawn: spawnMock
})

function makeProc(exitCode: number) {
  return {
    stderr: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      }
    }),
    exited: Promise.resolve(exitCode)
  }
}

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
    spawnMock.mockReturnValue(makeProc(0))

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
    const command = spawnMock.mock.calls[0]?.[0] as string[]
    expect(command).toContain('/usr/bin/ffmpeg')
    expect(command).toContain('libmp3lame')
    expect(command).toContain('-id3v2_version')
    expect(command).toContain('3')
    expect(command).toContain(`album=${files.album}`)
    expect(command.at(-1)).toBe(files.outputPath)
  })

  test('uses expected ffmpeg arguments for mp4 output', async () => {
    spawnMock.mockReturnValue(makeProc(0))

    const files = makeFiles('mp4')
    await Effect.runPromise(
      createAudioOrVideo(files, 'mp4').pipe(
        Effect.provideService(MixProcessingConfig, {
          ffmpegPath: '/usr/bin/ffmpeg',
          introAudioPath: '/tmp/intro.mp3'
        })
      )
    )

    const command = spawnMock.mock.calls[0]?.[0] as string[]
    expect(command).toContain('/usr/bin/ffmpeg')
    expect(command).toContain('-loop')
    expect(command).toContain('libx264')
    expect(command).toContain('-shortest')
    expect(command.at(-1)).toBe(files.outputPath)
  })

  test('maps non-zero ffmpeg exit to MixProcessingError', async () => {
    spawnMock.mockReturnValue(makeProc(1))

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
    spawnMock.mockImplementation((command) => {
      const outputPath = command.at(-1)
      if (outputPath) {
        fs.writeFileSync(outputPath, Buffer.from('encoded-output'))
      }

      return makeProc(0)
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
