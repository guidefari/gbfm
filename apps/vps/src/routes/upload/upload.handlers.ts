import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { uploadToS3 } from '@/bucket'
import { Resource } from 'sst'

import type { UploadFileRoute } from './upload.routes'

export const uploadFile: AppRouteHandler<UploadFileRoute> = async (c) => {
  try {
    const formData = await c.req.formData()
    const fileType = formData.get('fileType') as string

    let file: File | null = null

    if (fileType === 'audio') {
      file = formData.get('audioFile') as File
    } else if (fileType === 'image') {
      file = formData.get('imageFile') as File
    }

    if (!file) {
      return c.json({ error: 'No file provided' }, HttpStatusCodes.BAD_REQUEST)
    }

    // Validate file size (200MB for audio, 10MB for images)
    const maxSize = fileType === 'audio' ? 200 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      return c.json(
        {
          error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`
        },
        HttpStatusCodes.BAD_REQUEST
      )
    }

    // Validate file type
    if (fileType === 'audio' && !file.type.startsWith('audio/')) {
      return c.json(
        { error: 'Invalid audio file type' },
        HttpStatusCodes.BAD_REQUEST
      )
    }

    if (fileType === 'image' && !file.type.startsWith('image/')) {
      return c.json(
        { error: 'Invalid image file type' },
        HttpStatusCodes.BAD_REQUEST
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${fileType}_${timestamp}_${sanitizedName}`

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // Upload to S3
    const bucketName = Resource.User_Content.name
    const key = await uploadToS3({
      key: fileName,
      body: fileBuffer,
      contentType: file.type,
      bucketName
    })

    // Construct public URL
    const publicUrl = `${Resource.Router.url}/user-content/${key}`

    return c.json(
      {
        url: publicUrl,
        key
      },
      HttpStatusCodes.OK
    )
  } catch (error) {
    console.error('File upload error:', error)
    return c.json(
      { error: 'Failed to upload file' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
