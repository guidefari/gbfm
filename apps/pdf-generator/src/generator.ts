import fontkit from '@pdf-lib/fontkit'
import { Data, Effect } from 'effect'
import { PDFDocument, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import type { QrPdfRequest, QrPdfResponse } from './contract'

export class QrPdfGenerationError extends Data.TaggedError('QrPdfGenerationError')<{
  readonly message: string
  readonly stage: 'cache-read' | 'font-read' | 'generate' | 'cache-write'
}> {}

export interface QrPdfDependencies {
  readonly exists: (key: string) => Effect.Effect<boolean, QrPdfGenerationError>
  readonly put: (
    key: string,
    bytes: Uint8Array,
    contentType: string
  ) => Effect.Effect<void, QrPdfGenerationError>
  readonly loadFont: (
    name: 'JetBrainsMono-Bold.ttf' | 'JetBrainsMono-ExtraBold.ttf'
  ) => Effect.Effect<Uint8Array, QrPdfGenerationError>
  readonly cdnUrl: string
}

const colors = {
  highlight: rgb(0.608, 0.992, 0.62),
  darkerBg: rgb(0.067, 0.094, 0.153),
  pastelGreen1: rgb(0.714, 0.98, 0.875),
  pastelGreen2: rgb(0.306, 0.549, 0.443)
}

const templateVersion = 'jetbrains-mono-v1'

const cacheKey = (input: QrPdfRequest) =>
  Effect.tryPromise({
    try: async () => {
      const identity = JSON.stringify([
        templateVersion,
        input.kind,
        input.slug,
        input.title,
        input.people
      ])
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))
      const version = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0')
      )
        .join('')
        .slice(0, 16)
      return `qr-pdfs/qr/${input.kind === 'show' ? 'show-' : ''}${input.slug}-${version}.pdf`
    },
    catch: (error) => new QrPdfGenerationError({ message: String(error), stage: 'generate' })
  })

const destinationUrl = (input: QrPdfRequest) =>
  `https://goosebumps.fm/${input.kind === 'show' ? 'shows' : 'mixes'}/${input.slug}`

const generatePdf = (input: QrPdfRequest, boldBytes: Uint8Array, extraBoldBytes: Uint8Array) =>
  Effect.tryPromise({
    try: async () => {
      const qrDataUrl = await QRCode.toDataURL(destinationUrl(input), {
        width: 400,
        margin: 1,
        color: { dark: '#9bfd9e', light: '#111827' },
        errorCorrectionLevel: 'H'
      })
      const pdfDoc = await PDFDocument.create()
      pdfDoc.registerFontkit(fontkit)

      const fontBold = await pdfDoc.embedFont(boldBytes, { subset: true })
      const fontExtraBold = await pdfDoc.embedFont(extraBoldBytes, { subset: true })
      const page = pdfDoc.addPage([612, 792])
      const { width, height } = page.getSize()

      page.drawRectangle({ x: 0, y: 0, width, height, color: colors.darkerBg })
      page.drawText('goosebumps.', {
        x: 80,
        y: height - 120,
        size: 48,
        font: fontExtraBold,
        color: colors.pastelGreen1
      })
      page.drawText('fm', {
        x: 80,
        y: height - 175,
        size: 48,
        font: fontExtraBold,
        color: colors.highlight
      })
      page.drawLine({
        start: { x: 80, y: height - 200 },
        end: { x: 130, y: height - 200 },
        thickness: 4,
        color: colors.highlight
      })

      const qrSize = 280
      const qrX = (width - qrSize) / 2
      const qrY = height - 530
      page.drawRectangle({
        x: qrX - 15,
        y: qrY - 15,
        width: qrSize + 30,
        height: qrSize + 30,
        color: colors.darkerBg,
        borderColor: colors.highlight,
        borderWidth: 3
      })

      const encodedQr = qrDataUrl.split(',')[1]
      if (encodedQr === undefined) throw new Error('QR encoder returned an invalid data URL')
      const qrImage = await pdfDoc.embedPng(
        Uint8Array.from(atob(encodedQr), (char) => char.charCodeAt(0))
      )
      page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

      const labelY = qrY - 50
      page.drawText('SCAN TO LISTEN', {
        x: 80,
        y: labelY,
        size: 12,
        font: fontBold,
        color: colors.pastelGreen2
      })

      const title = input.title.length > 28 ? `${input.title.substring(0, 25)}...` : input.title
      page.drawText(title.toUpperCase(), {
        x: 80,
        y: labelY - 45,
        size: 32,
        font: fontExtraBold,
        color: colors.pastelGreen1
      })

      if (input.people.length > 0) {
        page.drawText(`by ${input.people.join(' & ')}`.toUpperCase(), {
          x: 80,
          y: labelY - 80,
          size: 18,
          font: fontExtraBold,
          color: colors.highlight
        })
      }

      page.drawLine({
        start: { x: 80, y: 80 },
        end: { x: width - 80, y: 80 },
        thickness: 1,
        color: colors.pastelGreen2
      })
      page.drawText('goosebumps.fm', {
        x: 80,
        y: 55,
        size: 10,
        font: fontExtraBold,
        color: colors.pastelGreen2
      })

      const shortUrl = `goosebumps.fm/${input.slug}`
      page.drawText(shortUrl, {
        x: width - 80 - fontBold.widthOfTextAtSize(shortUrl, 10),
        y: 55,
        size: 10,
        font: fontBold,
        color: colors.pastelGreen2
      })

      return pdfDoc.save()
    },
    catch: (error) => new QrPdfGenerationError({ message: String(error), stage: 'generate' })
  })

export const generateQrPdf = (dependencies: QrPdfDependencies, input: QrPdfRequest) =>
  Effect.gen(function* () {
    const key = yield* cacheKey(input)
    if (yield* dependencies.exists(key)) {
      return {
        url: `${dependencies.cdnUrl}/user-content/${key}`,
        cached: true
      } satisfies QrPdfResponse
    }

    const [boldBytes, extraBoldBytes] = yield* Effect.all([
      dependencies.loadFont('JetBrainsMono-Bold.ttf'),
      dependencies.loadFont('JetBrainsMono-ExtraBold.ttf')
    ])
    const pdfBytes = yield* generatePdf(input, boldBytes, extraBoldBytes)
    yield* dependencies.put(key, pdfBytes, 'application/pdf')

    return {
      url: `${dependencies.cdnUrl}/user-content/${key}`,
      cached: false
    } satisfies QrPdfResponse
  })
