/* oxlint-disable effecttsgo/strict-effect-provide -- Each test invokes Effect.runPromise, making it an Effect application entry point. */
import { Effect, Exit } from 'effect'
import { describe, expect, it } from 'vitest'
import { ImageExportStubLayer } from '@/services/image-export/test'
import { ImageRenderError, ImageSaveError } from '@/services/image-export/errors'
import type { ImageExportStub } from '@/services/image-export/test'
import { exportTweetImageEffect } from './export-tweet-image'

const node = Object.create(null)

const request = (blob: Blob | null) => ({
  node,
  frameWidth: 540,
  slug: 'unreal',
  format: 'poster',
  blob
})

const run = (stub: ImageExportStub, blob: Blob | null) =>
  exportTweetImageEffect(request(blob)).pipe(
    Effect.provide(ImageExportStubLayer(stub)),
    Effect.runPromiseExit
  )

const prerendered = new Blob(['prerendered'], { type: 'image/png' })
const freshlyRendered = new Blob(['fresh'], { type: 'image/png' })

describe('exportTweetImageEffect', () => {
  it('saves the pre-rendered blob without rendering again', async () => {
    let renders = 0
    const saved: string[] = []

    const exit = await run(
      {
        render: Effect.sync(() => {
          renders += 1
          return freshlyRendered
        }),
        onSave: (fileName) => saved.push(fileName),
        save: Effect.succeed('shared')
      },
      prerendered
    )

    expect(exit).toStrictEqual(Exit.succeed('shared'))
    expect(renders).toBe(0)
    expect(saved).toStrictEqual(['unreal-poster.png'])
  })

  it('renders on demand when the tap beats the pre-render', async () => {
    let renders = 0
    const saved: string[] = []

    const exit = await run(
      {
        render: Effect.sync(() => {
          renders += 1
          return freshlyRendered
        }),
        onSave: (fileName) => saved.push(fileName),
        save: Effect.succeed('downloaded')
      },
      null
    )

    expect(exit).toStrictEqual(Exit.succeed('downloaded'))
    expect(renders).toBe(1)
    expect(saved).toStrictEqual(['unreal-poster.png'])
  })

  it('never saves when the on-demand fallback render fails', async () => {
    const saved: string[] = []

    const exit = await run(
      {
        render: Effect.fail(new ImageRenderError({ message: 'rasterization failed' })),
        onSave: (fileName) => saved.push(fileName)
      },
      null
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(saved).toStrictEqual([])
  })

  it('keeps a save failure in the error channel', async () => {
    const exit = await run(
      { save: Effect.fail(new ImageSaveError({ message: 'share failed' })) },
      prerendered
    )

    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('reports dismissal as a success outcome', async () => {
    const exit = await run({ save: Effect.succeed('dismissed') }, prerendered)

    expect(exit).toStrictEqual(Exit.succeed('dismissed'))
  })
})
