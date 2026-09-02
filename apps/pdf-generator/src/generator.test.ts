import { readFile } from 'node:fs/promises'
import { Effect } from 'effect'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, test } from 'vitest'
import type { QrPdfRequest } from './contract'
import { generateQrPdf, QrPdfGenerationError, type QrPdfDependencies } from './generator'

const fontUrl = (name: string) => new URL(`../assets/fonts/${name}`, import.meta.url)

const input: QrPdfRequest = {
  kind: 'mix',
  slug: 'night-drive',
  title: 'Night Drive',
  people: ['Guide Fari']
}

const makeDependencies = () => {
  const objects = new Map<string, Uint8Array>()
  const loadedFonts: string[] = []

  const dependencies: QrPdfDependencies = {
    cdnUrl: 'https://cdn.goosebumps.fm',
    exists: (key) => Effect.succeed(objects.has(key)),
    put: (key, bytes) =>
      Effect.sync(() => {
        objects.set(key, bytes)
      }),
    loadFont: (name) =>
      Effect.tryPromise({
        try: async () => {
          loadedFonts.push(name)
          return new Uint8Array(await readFile(decodeURIComponent(fontUrl(name).pathname)))
        },
        catch: (error) => new QrPdfGenerationError({ message: String(error), stage: 'font-read' })
      })
  }

  return { dependencies, loadedFonts, objects }
}

describe('generateQrPdf', () => {
  test('generates and caches a one-page PDF using the deployed fonts', async () => {
    const { dependencies, loadedFonts, objects } = makeDependencies()

    const first = await Effect.runPromise(generateQrPdf(dependencies, input))
    expect(first.cached).toBe(false)
    expect(first.url).toMatch(
      /^https:\/\/cdn\.goosebumps\.fm\/user-content\/qr-pdfs\/qr\/night-drive-[a-f0-9]{16}\.pdf$/
    )
    expect(loadedFonts).toEqual(['JetBrainsMono-Bold.ttf', 'JetBrainsMono-ExtraBold.ttf'])

    const [bytes] = objects.values()
    if (bytes === undefined) throw new Error('Expected the generated PDF to be cached')
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 })

    const second = await Effect.runPromise(generateQrPdf(dependencies, input))
    expect(second.cached).toBe(true)
    expect(loadedFonts).toHaveLength(2)
  })

  test('uses a separate cache key for shows', async () => {
    const { dependencies, objects } = makeDependencies()

    const result = await Effect.runPromise(generateQrPdf(dependencies, { ...input, kind: 'show' }))

    expect(result.url).toMatch(/\/qr-pdfs\/qr\/show-night-drive-[a-f0-9]{16}\.pdf$/)
    expect([...objects.keys()][0]).toMatch(/^qr-pdfs\/qr\/show-night-drive-[a-f0-9]{16}\.pdf$/)
  })

  test('changes the immutable cache key when rendered content changes', async () => {
    const { dependencies, objects } = makeDependencies()

    await Effect.runPromise(generateQrPdf(dependencies, input))
    await Effect.runPromise(generateQrPdf(dependencies, { ...input, title: 'Night Drive II' }))

    expect(objects.size).toBe(2)
  })
})
