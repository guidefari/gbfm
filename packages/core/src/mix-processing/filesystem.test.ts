import fs from 'node:fs/promises'
import path from 'node:path'
import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { cleanup, writeFilesToDisk } from './processing'
import type { MixProcessingInput } from './types'

function makeInput(): MixProcessingInput {
  return {
    audioBuffer: Buffer.from('audio-bytes'),
    imageBuffer: Buffer.from('image-bytes'),
    outputFormat: 'mp3',
    title: 'A Cool Mix',
    description: '01\tArtist\tTrack',
    artist: 'Artist',
    album: 'Album'
  }
}

describe('writeFilesToDisk', () => {
  test('writes input files and returns computed paths + metadata', async () => {
    const input = makeInput()
    const files = await Effect.runPromise(writeFilesToDisk(input))

    expect(path.basename(files.audioPath)).toBe('audio.mp3')
    expect(path.basename(files.imagePath)).toBe('cover.jpg')
    expect(path.basename(files.outputPath)).toBe('output.mp3')
    expect(files.description).toBe(input.description)
    expect(files.artist).toBe(input.artist)
    expect(files.album).toBe(input.album)

    await expect(fs.readFile(files.audioPath)).resolves.toEqual(input.audioBuffer)
    await expect(fs.readFile(files.imagePath)).resolves.toEqual(input.imageBuffer)

    await fs.rm(path.dirname(files.audioPath), { recursive: true, force: true })
  })

  test('fails with MixValidationError when required buffers are missing', async () => {
    const input = makeInput()
    Reflect.set(input, 'audioBuffer', undefined)

    await expect(Effect.runPromise(writeFilesToDisk(input))).rejects.toThrow(
      'Missing required files'
    )
  })
})

describe('cleanup', () => {
  test('removes generated files and temporary directory', async () => {
    const input = makeInput()
    const files = await Effect.runPromise(writeFilesToDisk(input))
    await fs.writeFile(files.outputPath, Buffer.from('output'))

    await Effect.runPromise(cleanup(files))

    await expect(fs.access(path.dirname(files.audioPath))).rejects.toBeDefined()
  })

  test('swallows fs errors and still resolves', async () => {
    await expect(
      Effect.runPromise(
        cleanup({
          audioPath: '/tmp/gbfm-does-not-exist/audio.mp3',
          imagePath: '/tmp/gbfm-does-not-exist/cover.jpg',
          outputPath: '/tmp/gbfm-does-not-exist/output.mp3',
          description: ''
        })
      )
    ).resolves.toBeUndefined()
  })
})
