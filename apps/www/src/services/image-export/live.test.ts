/* oxlint-disable effecttsgo/strict-effect-provide -- Each test invokes Effect.runPromise, making it an Effect application entry point. */
import { Effect, Exit } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImageExport } from './service'
import { ImageExportLive } from './live'

const run = <A, E>(effect: Effect.Effect<A, E, ImageExport>) =>
  effect.pipe(Effect.provide(ImageExportLive), Effect.runPromiseExit)

const save = (blob: Blob, fileName: string) =>
  run(ImageExport.use((service) => service.save(blob, fileName)))

const pngBlob = () => new Blob(['png-bytes'], { type: 'image/png' })

describe('ImageExport.save', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('hands the file to the share sheet when the platform can share files', async () => {
    const shared: Array<ReadonlyArray<File>> = []
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: (data: { files: File[] }) => {
        shared.push(data.files)
        return Promise.resolve()
      }
    })

    const exit = await save(pngBlob(), 'tweet-poster.png')

    expect(exit).toStrictEqual(Exit.succeed('shared'))
    expect(shared).toHaveLength(1)
    expect(shared[0]?.[0]?.name).toBe('tweet-poster.png')
    expect(shared[0]?.[0]?.type).toBe('image/png')
  })

  it('reports dismissal rather than failure when the user closes the share sheet', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: () => Promise.reject(new DOMException('cancelled', 'AbortError'))
    })

    const exit = await save(pngBlob(), 'tweet-poster.png')

    expect(exit).toStrictEqual(Exit.succeed('dismissed'))
  })

  it('fails with ImageSaveError when the share sheet errors for another reason', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: () => Promise.reject(new DOMException('not allowed', 'NotAllowedError'))
    })

    const exit = await save(pngBlob(), 'tweet-poster.png')

    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('downloads through an object URL, never a data URL, when sharing is unavailable', async () => {
    vi.stubGlobal('navigator', { userAgent: 'test' })
    const createObjectURL = vi.fn(() => 'blob:tweet-poster')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const clicked: Array<{ href: string; download: string }> = []
    const anchor = {
      href: '',
      download: '',
      rel: '',
      click: () => clicked.push({ href: anchor.href, download: anchor.download }),
      remove: () => {}
    }
    vi.stubGlobal('document', {
      createElement: () => anchor,
      body: { appendChild: () => {} }
    })

    const exit = await save(pngBlob(), 'tweet-poster.png')

    expect(exit).toStrictEqual(Exit.succeed('downloaded'))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clicked).toHaveLength(1)
    expect(clicked[0]?.href).toBe('blob:tweet-poster')
    expect(clicked[0]?.download).toBe('tweet-poster.png')
  })
})
