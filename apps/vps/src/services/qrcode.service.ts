import { Context, Effect, Layer } from 'effect'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import { DatabaseError, getErrorMessage } from '@/errors'
import { config } from '@/services/config.service'
import { S3Service } from '@/services/s3.service'

type QRTemplate = 'flyer' | 'qr'

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
    template: QRTemplate
  ) => Effect.Effect<{ url: string; cached: boolean }, DatabaseError>
  readonly generateShowQRPdf: (
    show: ShowData,
    template: QRTemplate
  ) => Effect.Effect<{ url: string; cached: boolean }, DatabaseError>
}

export const QRCodeService = Context.GenericTag<QRCodeService>('QRCodeService')

const getCacheKey = (slug: string, template: QRTemplate) =>
  `qr-pdfs/${template}/${slug}.pdf`

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

const fetchImage = (url: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch image: ${url}`)
      return new Uint8Array(await response.arrayBuffer())
    },
    catch: (error) =>
      new DatabaseError({
        message: `Failed to fetch image: ${getErrorMessage(error)}`,
        operation: 'fetch',
        table: 'image'
      })
  })

// goosebumps.fm color palette
const colors = {
  highlight: rgb(0.608, 0.992, 0.62), // #9bfd9e
  bg: rgb(0.086, 0.227, 0.306), // hsl(202, 61%, 22%) ≈ #163a4e
  darkerBg: rgb(0.067, 0.094, 0.153), // #111827
  pastelGreen1: rgb(0.714, 0.98, 0.875), // #b6fadf
  pastelGreen2: rgb(0.306, 0.549, 0.443) // #4e8c71
}

const generateFlyerPdf = (mix: MixData, qrDataUrl: string) =>
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

    const helveticaBold = yield* Effect.tryPromise({
      try: () => pdfDoc.embedFont(StandardFonts.HelveticaBold),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to embed font: ${getErrorMessage(error)}`,
          operation: 'font',
          table: 'pdf'
        })
    })

    const helvetica = yield* Effect.tryPromise({
      try: () => pdfDoc.embedFont(StandardFonts.Helvetica),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to embed font: ${getErrorMessage(error)}`,
          operation: 'font',
          table: 'pdf'
        })
    })

    const courier = yield* Effect.tryPromise({
      try: () => pdfDoc.embedFont(StandardFonts.Courier),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to embed font: ${getErrorMessage(error)}`,
          operation: 'font',
          table: 'pdf'
        })
    })

    // Dark teal background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: colors.bg
    })

    const logoText = 'goosebumps.'
    const logoSize = 32
    const logoX = 50
    const logoY = height - 70
    page.drawText(logoText, {
      x: logoX,
      y: logoY,
      size: logoSize,
      font: helveticaBold,
      color: colors.pastelGreen1
    })

    const fmText = 'fm'
    const fmSize = 18
    const fmPadX = 6
    const fmPadY = 4
    const fmTextWidth = helveticaBold.widthOfTextAtSize(fmText, fmSize)
    const fmBoxX =
      logoX + helveticaBold.widthOfTextAtSize(logoText, logoSize) + 8
    const fmBoxY = logoY - 2
    const fmBoxW = fmTextWidth + fmPadX * 2
    const fmBoxH = fmSize + fmPadY * 2
    page.drawRectangle({
      x: fmBoxX,
      y: fmBoxY,
      width: fmBoxW,
      height: fmBoxH,
      color: colors.highlight
    })
    page.drawText(fmText, {
      x: fmBoxX + fmPadX,
      y: fmBoxY + fmPadY + 1,
      size: fmSize,
      font: helveticaBold,
      color: colors.darkerBg
    })

    page.drawText('BROADCAST ARCHIVE', {
      x: 50,
      y: height - 110,
      size: 10,
      font: helvetica,
      color: colors.pastelGreen2
    })

    const imageBoxY = height - 450
    const imageBoxWidth = width - 100
    const imageBoxHeight = 300

    // Image container with darker bg
    page.drawRectangle({
      x: 50,
      y: imageBoxY,
      width: imageBoxWidth,
      height: imageBoxHeight,
      color: colors.darkerBg
    })

    if (mix.thumbnailUrl) {
      const imageBytes = yield* fetchImage(mix.thumbnailUrl).pipe(
        Effect.orElseSucceed(() => null)
      )

      if (imageBytes) {
        const isJpeg =
          mix.thumbnailUrl.toLowerCase().includes('.jpg') ||
          mix.thumbnailUrl.toLowerCase().includes('.jpeg')
        const embedFn = isJpeg
          ? pdfDoc.embedJpg.bind(pdfDoc)
          : pdfDoc.embedPng.bind(pdfDoc)

        const image = yield* Effect.tryPromise({
          try: () => embedFn(imageBytes),
          catch: () => null
        }).pipe(Effect.orElseSucceed(() => null))

        if (image) {
          const imgDims = image.scale(1)
          const scale = Math.max(
            imageBoxWidth / imgDims.width,
            imageBoxHeight / imgDims.height
          )
          const scaledWidth = imgDims.width * scale
          const scaledHeight = imgDims.height * scale
          const imgX = 50 + (imageBoxWidth - scaledWidth) / 2
          const imgY = imageBoxY + (imageBoxHeight - scaledHeight) / 2

          page.drawImage(image, {
            x: imgX,
            y: imgY,
            width: scaledWidth,
            height: scaledHeight
          })

          // Mask overflow: cover left/right and top/bottom bleed with bg color
          const boxLeft = 50
          const boxRight = 50 + imageBoxWidth
          const boxBottom = imageBoxY
          const boxTop = imageBoxY + imageBoxHeight

          if (imgX < boxLeft) {
            page.drawRectangle({
              x: 0,
              y: boxBottom,
              width: boxLeft,
              height: imageBoxHeight,
              color: colors.bg
            })
          }
          if (imgX + scaledWidth > boxRight) {
            page.drawRectangle({
              x: boxRight,
              y: boxBottom,
              width: width - boxRight,
              height: imageBoxHeight,
              color: colors.bg
            })
          }
          if (imgY < boxBottom) {
            page.drawRectangle({
              x: boxLeft,
              y: 0,
              width: imageBoxWidth,
              height: boxBottom,
              color: colors.bg
            })
          }
          if (imgY + scaledHeight > boxTop) {
            page.drawRectangle({
              x: boxLeft,
              y: boxTop,
              width: imageBoxWidth,
              height: height - boxTop,
              color: colors.bg
            })
          }
        }
      }
    }

    const titleY = imageBoxY - 35
    const truncatedTitle =
      mix.title.length > 35 ? `${mix.title.substring(0, 32)}...` : mix.title
    page.drawText(truncatedTitle.toUpperCase(), {
      x: 50,
      y: titleY,
      size: 20,
      font: helveticaBold,
      color: colors.pastelGreen1
    })

    if (mix.creators && mix.creators.length > 0) {
      const creatorNames = mix.creators.map((c) => c.name).join(' & ')
      page.drawText(`Curated by ${creatorNames}`, {
        x: 50,
        y: titleY - 25,
        size: 12,
        font: helvetica,
        color: colors.pastelGreen2
      })
    }

    page.drawLine({
      start: { x: 50, y: titleY - 50 },
      end: { x: width - 50, y: titleY - 50 },
      thickness: 1,
      color: colors.pastelGreen2
    })

    const qrY = titleY - 180
    const qrSize = 100
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

    page.drawRectangle({
      x: 44,
      y: qrY - 6,
      width: qrSize + 12,
      height: qrSize + 12,
      color: colors.darkerBg,
      borderColor: colors.highlight,
      borderWidth: 2
    })

    page.drawImage(qrImage, {
      x: 50,
      y: qrY,
      width: qrSize,
      height: qrSize
    })

    page.drawText('SCAN TO LISTEN', {
      x: 170,
      y: qrY + 60,
      size: 10,
      font: helvetica,
      color: colors.pastelGreen2
    })

    const shortUrl = `goosebumps.fm/${mix.slug}`
    page.drawRectangle({
      x: 170,
      y: qrY + 25,
      width: courier.widthOfTextAtSize(shortUrl, 11) + 16,
      height: 22,
      color: colors.darkerBg,
      borderColor: colors.pastelGreen2,
      borderWidth: 1
    })

    page.drawText(shortUrl, {
      x: 178,
      y: qrY + 32,
      size: 11,
      font: courier,
      color: colors.pastelGreen1
    })

    page.drawLine({
      start: { x: 30, y: 40 },
      end: { x: 180, y: 40 },
      thickness: 0.5,
      color: colors.pastelGreen2,
      dashArray: [4, 2]
    })

    const footerUrl = `goosebumps.fm/${mix.slug}`
    page.drawText(footerUrl, {
      x: width - 50 - helvetica.widthOfTextAtSize(footerUrl, 9),
      y: 30,
      size: 9,
      font: helvetica,
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

    const helveticaBold = yield* Effect.tryPromise({
      try: () => pdfDoc.embedFont(StandardFonts.HelveticaBold),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to embed font: ${getErrorMessage(error)}`,
          operation: 'font',
          table: 'pdf'
        })
    })

    const helvetica = yield* Effect.tryPromise({
      try: () => pdfDoc.embedFont(StandardFonts.Helvetica),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to embed font: ${getErrorMessage(error)}`,
          operation: 'font',
          table: 'pdf'
        })
    })

    // Dark background (darker-bg)
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
      font: helveticaBold,
      color: colors.pastelGreen1
    })

    page.drawText('fm', {
      x: 80,
      y: height - 175,
      size: 48,
      font: helveticaBold,
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
      font: helvetica,
      color: colors.pastelGreen2
    })

    const truncatedTitle =
      mix.title.length > 28 ? `${mix.title.substring(0, 25)}...` : mix.title
    page.drawText(truncatedTitle.toUpperCase(), {
      x: 80,
      y: labelY - 45,
      size: 32,
      font: helveticaBold,
      color: colors.pastelGreen1
    })

    if (mix.creators && mix.creators.length > 0) {
      const creatorNames = mix.creators.map((c) => c.name).join(' & ')
      page.drawText(`by ${creatorNames}`.toUpperCase(), {
        x: 80,
        y: labelY - 80,
        size: 18,
        font: helveticaBold,
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
      font: helveticaBold,
      color: colors.pastelGreen2
    })

    const shortUrl = `goosebumps.fm/${mix.slug}`
    page.drawText(shortUrl, {
      x: width - 80 - helvetica.widthOfTextAtSize(shortUrl, 10),
      y: 55,
      size: 10,
      font: helvetica,
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

const generateMixQRPdfEffect = (
  mix: MixData,
  template: QRTemplate,
  s3Service: S3Service
) =>
  Effect.gen(function* () {
    const bucketName = config.buckets.userContent
    const routerUrl = config.urls.router

    const cacheKey = getCacheKey(mix.slug, template)
    const isCached = yield* s3Service.checkExists(cacheKey, bucketName)

    if (isCached) {
      const url = `${routerUrl}/user-content/${cacheKey}`
      return { url, cached: true }
    }

    const mixUrl = `https://goosebumps.fm/mixes/${mix.slug}`
    const qrDataUrl = yield* generateQRDataUrl(mixUrl)

    const pdfBytes =
      template === 'flyer'
        ? yield* generateFlyerPdf(mix, qrDataUrl)
        : yield* generateQROnlyPdf(mix, qrDataUrl)

    yield* s3Service
      .uploadFile(
        cacheKey,
        Buffer.from(pdfBytes),
        'application/pdf',
        bucketName
      )
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

    const url = `${routerUrl}/user-content/${cacheKey}`
    return { url, cached: false }
  })

const generateShowQRPdfEffect = (
  show: ShowData,
  template: QRTemplate,
  s3Service: S3Service
) =>
  Effect.gen(function* () {
    const bucketName = config.buckets.userContent
    const routerUrl = config.urls.router

    const cacheKey = getCacheKey(`show-${show.slug}`, template)
    const isCached = yield* s3Service.checkExists(cacheKey, bucketName)

    if (isCached) {
      const url = `${routerUrl}/user-content/${cacheKey}`
      return { url, cached: true }
    }

    const showUrl = `https://goosebumps.fm/shows/${show.slug}`
    const qrDataUrl = yield* generateQRDataUrl(showUrl)

    // Adapt show data to MixData shape for reusing PDF templates
    const mixLikeData: MixData = {
      slug: show.slug,
      title: show.title,
      thumbnailUrl: show.thumbnailUrl,
      creators: show.hosts
    }

    const pdfBytes =
      template === 'flyer'
        ? yield* generateFlyerPdf(mixLikeData, qrDataUrl)
        : yield* generateQROnlyPdf(mixLikeData, qrDataUrl)

    yield* s3Service
      .uploadFile(
        cacheKey,
        Buffer.from(pdfBytes),
        'application/pdf',
        bucketName
      )
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

    const url = `${routerUrl}/user-content/${cacheKey}`
    return { url, cached: false }
  })

export const QRCodeServiceLive = Layer.effect(
  QRCodeService,
  Effect.gen(function* () {
    const s3Service = yield* S3Service
    return {
      generateMixQRPdf: (mix: MixData, template: QRTemplate) =>
        generateMixQRPdfEffect(mix, template, s3Service).pipe(
          Effect.withSpan('qrcode.generateMixQRPdf', {
            attributes: { slug: mix.slug, template }
          })
        ),
      generateShowQRPdf: (show: ShowData, template: QRTemplate) =>
        generateShowQRPdfEffect(show, template, s3Service).pipe(
          Effect.withSpan('qrcode.generateShowQRPdf', {
            attributes: { slug: show.slug, template }
          })
        )
    }
  })
)
