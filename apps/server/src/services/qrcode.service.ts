import { Context, Effect, Layer } from 'effect'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import { DatabaseError, getErrorMessage } from '@/errors'
import { config } from '@/services/config.service'
import { S3Service } from '@/services/s3.service'

interface MixData {
  slug: string
  title: string
  thumbnailUrl?: string | null
  creators?: Array<{ name: string }>
}

interface ShowData {
  slug: string
  title: string
  thumbnailUrl?: string | null
  hosts?: Array<{ name: string }>
}

export interface QRCodeService {
  readonly generateMixQRPdf: (
    mix: MixData,
    force?: boolean
  ) => Effect.Effect<{ url: string; cached: boolean }, DatabaseError>
  readonly generateShowQRPdf: (
    show: ShowData,
    force?: boolean
  ) => Effect.Effect<{ url: string; cached: boolean }, DatabaseError>
}

export const QRCodeService = Context.Service<QRCodeService>('QRCodeService')

const getCacheKey = (slug: string) => `qr-pdfs/qr/${slug}.pdf`

const generateQRDataUrl = (url: string) =>
  Effect.tryPromise({
    try: () =>
      QRCode.toDataURL(url, {
        width: 400,
        margin: 1,
        color: {
          dark: '#9bfd9e',
          light: '#111827'
        },
        errorCorrectionLevel: 'H'
      }),
    catch: (error) =>
      new DatabaseError({
        message: `Failed to generate QR code: ${getErrorMessage(error)}`,
        operation: 'qr_generate',
        table: 'qrcode'
      })
  })

const colors = {
  highlight: rgb(0.608, 0.992, 0.62),
  darkerBg: rgb(0.067, 0.094, 0.153),
  pastelGreen1: rgb(0.714, 0.98, 0.875),
  pastelGreen2: rgb(0.306, 0.549, 0.443)
}

const generateQROnlyPdf = (mix: MixData, qrDataUrl: string) =>
  Effect.gen(function* () {
    const pdfDoc = yield* Effect.tryPromise({
      try: () => PDFDocument.create(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create PDF: ${getErrorMessage(error)}`,
          operation: 'create',
          table: 'pdf'
        })
    })

    const page = pdfDoc.addPage([612, 792])
    const { width, height } = page.getSize()

    const fontBold = yield* Effect.tryPromise({
      try: () => pdfDoc.embedFont(StandardFonts.HelveticaBold),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to embed font: ${getErrorMessage(error)}`,
          operation: 'font',
          table: 'pdf'
        })
    })

    const fontExtraBold = yield* Effect.tryPromise({
      try: () => pdfDoc.embedFont(StandardFonts.HelveticaBold),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to embed font: ${getErrorMessage(error)}`,
          operation: 'font',
          table: 'pdf'
        })
    })

    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: colors.darkerBg
    })

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

    const qrImage = yield* Effect.tryPromise({
      try: async () => {
        const base64Data = qrDataUrl.split(',')[1]
        if (!base64Data) throw new Error('Invalid QR data URL')
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        return pdfDoc.embedPng(bytes)
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to embed QR: ${getErrorMessage(error)}`,
          operation: 'embed',
          table: 'pdf'
        })
    })

    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize
    })

    const labelY = qrY - 50
    page.drawText('SCAN TO LISTEN', {
      x: 80,
      y: labelY,
      size: 12,
      font: fontBold,
      color: colors.pastelGreen2
    })

    const truncatedTitle = mix.title.length > 28 ? `${mix.title.substring(0, 25)}...` : mix.title
    page.drawText(truncatedTitle.toUpperCase(), {
      x: 80,
      y: labelY - 45,
      size: 32,
      font: fontExtraBold,
      color: colors.pastelGreen1
    })

    if (mix.creators && mix.creators.length > 0) {
      const creatorNames = mix.creators.map((c) => c.name).join(' & ')
      page.drawText(`by ${creatorNames}`.toUpperCase(), {
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

    const shortUrl = `goosebumps.fm/${mix.slug}`
    page.drawText(shortUrl, {
      x: width - 80 - fontBold.widthOfTextAtSize(shortUrl, 10),
      y: 55,
      size: 10,
      font: fontBold,
      color: colors.pastelGreen2
    })

    return yield* Effect.tryPromise({
      try: () => pdfDoc.save(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to save PDF: ${getErrorMessage(error)}`,
          operation: 'save',
          table: 'pdf'
        })
    })
  })

const generateMixQRPdfEffect = (mix: MixData, s3Service: S3Service, force?: boolean) =>
  Effect.gen(function* () {
    const bucketName = config.buckets.userContent
    const cdnUrl = config.urls.bucketRouter

    const cacheKey = getCacheKey(mix.slug)
    const isCached = force ? false : yield* s3Service.checkExists(cacheKey, bucketName)

    if (isCached) {
      const url = `${cdnUrl}/user-content/${cacheKey}`
      return { url, cached: true }
    }

    const mixUrl = `https://goosebumps.fm/mixes/${mix.slug}`
    const qrDataUrl = yield* generateQRDataUrl(mixUrl)
    const pdfBytes = yield* generateQROnlyPdf(mix, qrDataUrl)

    yield* s3Service
      .uploadFile(cacheKey, Buffer.from(pdfBytes), 'application/pdf', bucketName)
      .pipe(
        Effect.mapError(
          (e) =>
            new DatabaseError({
              message: `Failed to cache PDF: ${e.message}`,
              operation: 'put',
              table: 's3'
            })
        )
      )

    const url = `${cdnUrl}/user-content/${cacheKey}`
    return { url, cached: false }
  })

const generateShowQRPdfEffect = (show: ShowData, s3Service: S3Service, force?: boolean) =>
  Effect.gen(function* () {
    const bucketName = config.buckets.userContent
    const cdnUrl = config.urls.bucketRouter

    const cacheKey = getCacheKey(`show-${show.slug}`)
    const isCached = force ? false : yield* s3Service.checkExists(cacheKey, bucketName)

    if (isCached) {
      const url = `${cdnUrl}/user-content/${cacheKey}`
      return { url, cached: true }
    }

    const showUrl = `https://goosebumps.fm/shows/${show.slug}`
    const qrDataUrl = yield* generateQRDataUrl(showUrl)

    const mixLikeData: MixData = {
      slug: show.slug,
      title: show.title,
      thumbnailUrl: show.thumbnailUrl,
      creators: show.hosts
    }

    const pdfBytes = yield* generateQROnlyPdf(mixLikeData, qrDataUrl)

    yield* s3Service
      .uploadFile(cacheKey, Buffer.from(pdfBytes), 'application/pdf', bucketName)
      .pipe(
        Effect.mapError(
          (e) =>
            new DatabaseError({
              message: `Failed to cache PDF: ${e.message}`,
              operation: 'put',
              table: 's3'
            })
        )
      )

    const url = `${cdnUrl}/user-content/${cacheKey}`
    return { url, cached: false }
  })

export const QRCodeServiceLayer = Layer.effect(
  QRCodeService,
  Effect.gen(function* () {
    const s3Service = yield* S3Service
    return {
      generateMixQRPdf: (mix: MixData, force?: boolean) =>
        generateMixQRPdfEffect(mix, s3Service, force).pipe(
          Effect.withSpan('qrcode.generateMixQRPdf', {
            attributes: { slug: mix.slug }
          })
        ),
      generateShowQRPdf: (show: ShowData, force?: boolean) =>
        generateShowQRPdfEffect(show, s3Service, force).pipe(
          Effect.withSpan('qrcode.generateShowQRPdf', {
            attributes: { slug: show.slug }
          })
        )
    }
  })
)
