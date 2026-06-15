import { config } from '@/services/config.service'

type CDN_URL = string

export async function uploadAvatar(file: File): Promise<CDN_URL> {
  const { uploadToS3 } = await import('@/bucket')
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const fileName = `avatar_${Date.now()}_${file.name.replace(/\s+/g, '_')}`
  const bucketName = config.buckets.userContent
  const contentType = file.type || 'application/octet-stream'

  await uploadToS3({
    key: fileName,
    body: fileBuffer,
    contentType,
    bucketName
  })

  return `${config.urls.bucketRouter}/user-content/${fileName}`
}
