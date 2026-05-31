# Image Processing Service Feature

## Overview

The Image Processing Service provides automatic image transcoding, resizing, and optimization for all uploaded images in the GBFM platform. It generates multiple size variants (thumbnails, avatars, hero images) using modern formats (WebP/AVIF) with fallback to original images during processing. The service integrates seamlessly with the existing S3 storage and Effect-based architecture.

## Implementation Status 📋

- **Service Interface**: 🔄 Planned (Effect-based service design)
- **Job Queue System**: 🔄 Planned (Database-backed async processing)
- **Sharp Integration**: 🔄 Planned (Image processing with Sharp library)
- **Database Schema**: 🔄 Planned (Processing jobs tracking)
- **API Integration**: 🔄 Planned (Upload flow enhancements)
- **Migration Tools**: 🔄 Planned (Process existing images)
- **Monitoring**: 🔄 Planned (Processing metrics and health checks)

## Architecture

### Core Components

- **ImageProcessingService**: Effect-based service for image operations
- **JobQueueService**: Async job processing with database persistence
- **Sharp Processor**: Image transcoding and resizing engine
- **S3 Integration**: Storage for original and processed images
- **Database Tracking**: Job status and metadata management

### Technology Stack

- **Image Processing**: [Sharp](https://sharp.pixelplumbing.com/) - High-performance Node.js image processing
- **Queue**: Database-backed job queue (simple, VPS-friendly)
- **Formats**: WebP (primary), JPEG (fallback), AVIF (future)
- **Architecture**: Effect-based functional programming pattern
- **Storage**: Existing S3 infrastructure

## Service Design

### Core Interface

```typescript
// Location: apps/vps/src/services/image-processing.service.ts
export interface ImageProcessingService {
  readonly queueImageProcessing: (
    originalKey: string,
    context?: ImageContext
  ) => Effect.Effect<ProcessingJobId, ImageProcessingError>

  readonly getImageUrl: (
    originalKey: string,
    variant: ImageVariant,
    context?: ImageContext
  ) => Effect.Effect<string, ImageProcessingError>

  readonly getProcessingStatus: (
    jobId: ProcessingJobId
  ) => Effect.Effect<ProcessingStatus, ImageProcessingError>

  readonly processExistingImages: () => Effect.Effect<void, ImageProcessingError>
}
```

### Type Definitions

```typescript
export type ImageContext = 'avatar' | 'thumbnail' | 'hero' | 'general'

export type ImageVariant =
  | 'avatar_small' // 64x64
  | 'avatar_medium' // 128x128
  | 'avatar_large' // 256x256
  | 'thumbnail_small' // 200x200
  | 'thumbnail_medium' // 400x400
  | 'thumbnail_large' // 800x600
  | 'hero_small' // 800x450
  | 'hero_medium' // 1200x675
  | 'hero_large' // 1920x1080

export interface ProcessingJob {
  id: ProcessingJobId
  originalKey: string
  context: ImageContext
  status: ProcessingStatus
  createdAt: Date
  completedAt?: Date
  variants?: ImageVariant[]
  error?: string
}

export type ProcessingStatus = 'queued' | 'processing' | 'completed' | 'failed'
```

## Image Variant Specifications

### Avatar Images (Square, High Quality)

| Variant         | Dimensions | WebP Quality | JPEG Fallback | Use Case        |
| --------------- | ---------- | ------------ | ------------- | --------------- |
| `avatar_small`  | 64x64      | 85%          | 90%           | User list views |
| `avatar_medium` | 128x128    | 85%          | 90%           | Profile cards   |
| `avatar_large`  | 256x256    | 85%          | 90%           | Profile pages   |

### Thumbnail Images (Content-Aware Crop)

| Variant            | Dimensions | WebP Quality | JPEG Fallback | Use Case      |
| ------------------ | ---------- | ------------ | ------------- | ------------- |
| `thumbnail_small`  | 200x200    | 80%          | 85%           | List views    |
| `thumbnail_medium` | 400x400    | 80%          | 85%           | Grid displays |
| `thumbnail_large`  | 800x600    | 80%          | 85%           | Previews      |

### Hero Images (16:9 Aspect Ratio)

| Variant       | Dimensions | WebP Quality | JPEG Fallback | Use Case       |
| ------------- | ---------- | ------------ | ------------- | -------------- |
| `hero_small`  | 800x450    | 75%          | 80%           | Mobile headers |
| `hero_medium` | 1200x675   | 75%          | 80%           | Desktop views  |
| `hero_large`  | 1920x1080  | 75%          | 80%           | Full screen    |

## File Naming Convention

```
original:                     image_1234567890_photo.jpg
variants:                     image_1234567890_photo_avatar_small.webp
                              image_1234567890_photo_avatar_small.jpg
                              image_1234567890_photo_thumbnail_medium.webp
                              image_1234567890_photo_hero_large.webp
```

**Pattern**: `{original_name}_{variant}.{format}`

## Database Schema

### Processing Jobs Table

```sql
CREATE TABLE image_processing_jobs (
  id TEXT PRIMARY KEY,
  original_key TEXT NOT NULL,
  context TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  variants TEXT[], -- Array of completed variants
  error TEXT,

  -- Indexes for performance
  INDEX idx_image_jobs_original_key ON image_processing_jobs(original_key),
  INDEX idx_image_jobs_status ON image_processing_jobs(status),
  INDEX idx_image_jobs_created_at ON image_processing_jobs(created_at)
);
```

**Key Fields:**

- `original_key`: Reference to S3 original image
- `context`: Processing context (avatar/thumbnail/hero)
- `variants`: Array of successfully generated variants
- `error`: Processing error details for debugging

## Implementation Details

### 1. Service Implementation

```typescript
// apps/vps/src/services/image-processing.service.ts
import { Effect, Layer, Context } from 'effect'
import { S3Service } from './s3.service'
import { ConfigService } from './config.service'

const ImageProcessingService = Context.GenericTag<ImageProcessingService>('ImageProcessingService')

const queueImageProcessing = (originalKey: string, context: ImageContext = 'general') =>
  Effect.gen(function* () {
    const s3Service = yield* S3Service
    const config = yield* ConfigService

    // Create job record
    const jobId = yield* createProcessingJob(originalKey, context)

    // Queue for async processing
    yield* JobQueueService.enqueue('image-processing', {
      jobId,
      originalKey,
      context
    })

    return jobId
  })

const getImageUrl = (originalKey: string, variant: ImageVariant, context?: ImageContext) =>
  Effect.gen(function* () {
    const s3Service = yield* S3Service
    const config = yield* ConfigService

    const variantKey = getVariantKey(originalKey, variant)

    // Check if variant exists
    const exists = yield* s3Service
      .fileExists(variantKey)
      .pipe(Effect.catchAll(() => Effect.succeed(false)))

    if (!exists) {
      // Queue for processing + return original temporarily
      yield* queueImageProcessing(originalKey, context || 'general')
      return getOriginalUrl(originalKey, config)
    }

    return getVariantUrl(variantKey, config)
  })
```

### 2. Image Processing Worker

```typescript
// apps/vps/src/workers/image-processing.worker.ts
import sharp from 'sharp'

const processImageJob = (job: ImageProcessingJob) =>
  Effect.gen(function* () {
    const s3Service = yield* S3Service
    const config = yield* ConfigService

    // Download original image
    const originalBuffer = yield* s3Service.getFile(job.originalKey)

    // Get image metadata
    const metadata = yield* Effect.tryPromise({
      try: () => sharp(originalBuffer).metadata(),
      catch: (error) =>
        new ImageProcessingError({
          message: `Failed to read image metadata: ${error.message}`,
          operation: 'process',
          originalKey: job.originalKey
        })
    })

    // Determine variants to generate based on context
    const variants = getVariantsForContext(job.context)

    // Process each variant
    yield* Effect.forEach(
      variants,
      (variant) => generateVariant(originalBuffer, variant, metadata, s3Service, config),
      { concurrency: 2 }
    )

    // Update job status
    yield* updateProcessingJob(job.id, {
      status: 'completed',
      completedAt: new Date(),
      variants
    })
  })

const generateVariant = (
  originalBuffer: Buffer,
  variant: ImageVariant,
  metadata: sharp.Metadata,
  s3Service: S3Service,
  config: ConfigService
) =>
  Effect.gen(function* () {
    const variantConfig = getVariantConfig(variant)
    const originalKey = metadata

    // Process image with Sharp
    const processedBuffer = yield* Effect.tryPromise({
      try: async () => {
        let processor = sharp(originalBuffer).resize(variantConfig.width, variantConfig.height, {
          fit: variantConfig.fit,
          withoutEnlargement: true
        })

        // Apply format-specific optimizations
        if (variantConfig.format === 'webp') {
          processor = processor.webp({ quality: variantConfig.quality })
        } else {
          processor = processor.jpeg({ quality: variantConfig.quality })
        }

        return processor.toBuffer()
      },
      catch: (error) =>
        new ImageProcessingError({
          message: `Failed to process variant ${variant}: ${error.message}`,
          operation: 'process',
          variant
        })
    })

    // Upload to S3
    const variantKey = getVariantKey(originalKey, variant)
    const contentType = variantConfig.format === 'webp' ? 'image/webp' : 'image/jpeg'

    yield* s3Service.uploadFile(
      variantKey,
      processedBuffer,
      contentType,
      config.buckets.userContent
    )
  })
```

### 3. Integration with Upload Flow

```typescript
// apps/vps/src/routes/upload/upload.handlers.ts
export const uploadFile: AppRouteHandler<UploadFileRoute> = async (c) => {
  // ... existing validation logic

  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service
    const imageService = yield* ImageProcessingService

    // Upload original file
    const fileBuffer = Buffer.from(yield* Effect.promise(() => file.arrayBuffer()))

    const key = yield* s3Service.uploadFile(
      fileName,
      fileBuffer,
      file.type,
      config.buckets.userContent
    )

    // Queue for processing if it's an image
    if (fileType === 'image') {
      const context = inferImageContext(key, file.name)
      yield* imageService.queueImageProcessing(key, context)
    }

    const publicUrl = `${config.urls.router}/user-content/${key}`
    return { url: publicUrl, key }
  })

  // ... existing error handling
}
```

### 4. Avatar Upload Enhancement

```typescript
// apps/vps/src/routes/user/user.util.ts
export async function uploadAvatar(file: File): Promise<CDN_URL> {
  const program = Effect.gen(function* () {
    const imageService = yield* ImageProcessingService
    const config = yield* ConfigService

    // Upload original
    const key = yield* uploadOriginalImage(file)

    // Queue for avatar processing
    yield* imageService.queueImageProcessing(key, 'avatar')

    // Return small avatar for immediate use
    return yield* imageService.getImageUrl(key, 'avatar_small', 'avatar')
  })

  return await AppRuntime.runPromise(program)
}
```

## API Endpoints

### Admin Endpoints

```typescript
// apps/vps/src/routes/admin/image-processing.routes.ts
export const getProcessingStatus = createRoute({
  path: '/admin/image-processing/status/:jobId',
  method: 'get',
  middleware: [requireAdmin],
  request: {
    params: z.object({ jobId: z.string() })
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(processingJobSchema, 'Job status'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Job not found')
  }
})

export const reprocessImage = createRoute({
  path: '/admin/image-processing/reprocess',
  method: 'post',
  middleware: [requireAdmin],
  request: {
    body: jsonContentRequired(z.object({ originalKey: z.string() }), 'Image to reprocess')
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ jobId: z.string() }), 'Reprocessing started')
  }
})

export const getProcessingStats = createRoute({
  path: '/admin/image-processing/stats',
  method: 'get',
  middleware: [requireAdmin],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        totalJobs: z.number(),
        pendingJobs: z.number(),
        completedJobs: z.number(),
        failedJobs: z.number(),
        averageProcessingTime: z.number()
      }),
      'Processing statistics'
    )
  }
})
```

## Migration Strategy

### 1. Process Existing Images

```typescript
// apps/vps/src/scripts/migrate-images.ts
export const processExistingImages = Effect.gen(function* () {
  const s3Service = yield* S3Service
  const imageService = yield* ImageProcessingService

  // List all existing images
  const imageKeys = yield* s3Service.listFiles('user-content/', '.jpg|.png|.jpeg|.webp')

  // Filter out already processed images
  const unprocessedKeys = yield* Effect.filter(imageKeys, async (key) => {
    const status = await getProcessingStatus(key)
    return !status || status.status === 'failed'
  })

  // Process in batches to avoid overwhelming the system
  yield* Effect.forEach(
    unprocessedKeys,
    (key) => imageService.queueImageProcessing(key, inferImageContext(key)),
    { concurrency: 5 }
  )

  yield* Effect.log(`Queued ${unprocessedKeys.length} images for processing`)
})
```

### 2. Gradual Rollout

```typescript
// apps/vps/src/services/image-processing.service.ts
const shouldProcessImage = (key: string) =>
  Effect.gen(function* () {
    const config = yield* ConfigService

    // Check rollout percentage
    const rolloutPercentage = config.imageProcessing.rolloutPercentage || 0

    if (rolloutPercentage === 0) {
      return false // Feature disabled
    }

    if (rolloutPercentage === 100) {
      return true // Feature fully enabled
    }

    // Hash-based consistent sampling
    const hash = hashString(key)
    return hash % 100 < rolloutPercentage
  })
```

## Error Handling

### Error Types

```typescript
export class ImageProcessingError extends Data.TaggedError('ImageProcessingError') {
  constructor(
    readonly message: string,
    readonly operation: 'queue' | 'process' | 'fetch' | 'upload',
    readonly originalKey?: string,
    readonly variant?: ImageVariant,
    readonly cause?: Error
  ) {}
}

export class ImageProcessingQueueError extends Data.TaggedError('ImageProcessingQueueError') {
  constructor(
    readonly message: string,
    readonly jobId?: ProcessingJobId,
    readonly cause?: Error
  ) {}
}
```

### Error Recovery

```typescript
const retryFailedJobs = Effect.gen(function* () {
  const db = yield* DatabaseService

  // Find jobs that failed more than 1 hour ago
  const failedJobs = yield* db.query.imageProcessingJobs.findMany({
    where: and(
      eq(imageProcessingJobs.status, 'failed'),
      lt(imageProcessingJobs.createdAt, new Date(Date.now() - 3600000))
    ),
    limit: 10
  })

  // Requeue with exponential backoff
  yield* Effect.forEach(
    failedJobs,
    (job) =>
      Effect.gen(function* () {
        yield* JobQueueService.enqueue('image-processing', {
          jobId: job.id,
          originalKey: job.originalKey,
          context: job.context,
          retryCount: (job.retryCount || 0) + 1
        })

        yield* db
          .update(imageProcessingJobs)
          .set({ status: 'queued' })
          .where(eq(imageProcessingJobs.id, job.id))
      }),
    { concurrency: 3 }
  )
})
```

## Performance Considerations

### Resource Management

```typescript
// apps/vps/src/workers/image-processing.worker.ts
const workerConfig = {
  maxConcurrentJobs: 3, // VPS-friendly
  maxMemoryPerJob: 100 * 1024 * 1024, // 100MB
  jobTimeout: 30000, // 30 seconds
  retryAttempts: 3
}

const processImageWithLimits = (job: ImageProcessingJob) =>
  Effect.gen(function* () {
    // Apply resource limits
    return yield* processImageJob(job).pipe(
      Effect.timeout(workerConfig.jobTimeout),
      Effect.retry(Schedule.exponential(1000).pipe(Schedule.compose(Schedule.recurs(3)))),
      Effect.withSpan('image.processing', {
        attributes: {
          'image.original_key': job.originalKey,
          'image.context': job.context,
          'job.id': job.id
        }
      })
    )
  })
```

### Monitoring

```typescript
// apps/vps/src/services/image-processing.service.ts
const processingMetrics = {
  jobsProcessed: new Counter({
    name: 'image_processing_jobs_total',
    help: 'Total number of image processing jobs',
    labelNames: ['status', 'context']
  }),

  processingDuration: new Histogram({
    name: 'image_processing_duration_seconds',
    help: 'Time spent processing images',
    labelNames: ['context', 'variant_count']
  }),

  queueDepth: new Gauge({
    name: 'image_processing_queue_depth',
    help: 'Number of jobs waiting to be processed'
  })
}
```

## Testing Strategy

### Unit Tests

```typescript
// apps/vps/src/services/__tests__/image-processing.service.test.ts
import { Effect } from 'effect'
import { ImageProcessingService } from '../image-processing.service'
import { S3Service } from '../s3.service'

describe('ImageProcessingService', () => {
  it('should queue image for processing', async () => {
    const program = Effect.gen(function* () {
      const imageService = yield* ImageProcessingService

      const jobId = yield* imageService.queueImageProcessing('test/image.jpg', 'avatar')

      expect(jobId).toBeDefined()

      const status = yield* imageService.getProcessingStatus(jobId)
      expect(status.status).toBe('queued')
    })

    await Effect.runPromise(program)
  })

  it('should return original URL when variant not processed', async () => {
    const program = Effect.gen(function* () {
      const imageService = yield* ImageProcessingService

      const url = yield* imageService.getImageUrl('test/image.jpg', 'avatar_small')

      expect(url).toContain('test/image.jpg')
    })

    await Effect.runPromise(program)
  })
})
```

### Integration Tests

```typescript
// apps/vps/src/routes/__tests__/upload.integration.test.ts
describe('Upload Integration', () => {
  it('should process uploaded images', async () => {
    const testImage = Buffer.from('fake-image-data')

    const response = await app.request('/upload/file', {
      method: 'POST',
      body: new FormData()
        .append('imageFile', new Blob([testImage]), 'test.jpg')
        .append('fileType', 'image')
    })

    expect(response.status).toBe(200)
    const { key } = await response.json()

    // Check if processing job was created
    const job = await db.query.imageProcessingJobs.findFirst({
      where: eq(imageProcessingJobs.originalKey, key)
    })

    expect(job).toBeDefined()
    expect(job.status).toBe('queued')
  })
})
```

## Security Considerations

### Input Validation

```typescript
const validateImageFile = (file: File) =>
  Effect.gen(function* () {
    // File type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

    if (!allowedTypes.includes(file.type)) {
      return yield* Effect.fail(
        new ImageProcessingError({
          message: `Unsupported file type: ${file.type}`,
          operation: 'queue'
        })
      )
    }

    // File size validation
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return yield* Effect.fail(
        new ImageProcessingError({
          message: `File too large: ${file.size} bytes`,
          operation: 'queue'
        })
      )
    }

    // Image header validation (basic magic number check)
    const buffer = Buffer.from(await file.arrayBuffer())
    const isValidImage = yield* Effect.tryPromise({
      try: () => sharp(buffer).metadata(),
      catch: () => null
    })

    if (!isValidImage) {
      return yield* Effect.fail(
        new ImageProcessingError({
          message: 'Invalid image file',
          operation: 'queue'
        })
      )
    }

    return file
  })
```

### Resource Protection

```typescript
const protectAgainstAbuse = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService

    // Rate limiting: max 10 jobs per hour per user
    const recentJobs = await db.query.imageProcessingJobs.count({
      where: and(
        eq(imageProcessingJobs.createdBy, userId),
        gt(imageProcessingJobs.createdAt, new Date(Date.now() - 3600000))
      )
    })

    if (recentJobs >= 10) {
      return yield* Effect.fail(
        new ImageProcessingError({
          message: 'Too many image processing requests',
          operation: 'queue'
        })
      )
    }

    // Storage quota: check user's total image storage
    const totalStorage = await calculateUserStorageUsage(userId)
    const maxStorage = 500 * 1024 * 1024 // 500MB

    if (totalStorage > maxStorage) {
      return yield* Effect.fail(
        new ImageProcessingError({
          message: 'Storage quota exceeded',
          operation: 'queue'
        })
      )
    }
  })
```

## Deployment Checklist

### Pre-Deployment

- [ ] Add Sharp dependency to package.json
- [ ] Create database migration for `image_processing_jobs` table
- [ ] Implement service interfaces and base implementations
- [ ] Add job queue worker process
- [ ] Configure monitoring and alerting

### Post-Deployment

- [ ] Run migration on production database
- [ ] Deploy worker process alongside existing API
- [ ] Start gradual rollout (begin with 10% of uploads)
- [ ] Monitor processing performance and error rates
- [ ] Process existing images in batches
- [ ] Verify CDN caching behavior

### Configuration

```typescript
// apps/vps/src/config/image-processing.config.ts
export const imageProcessingConfig = {
  // Rollout percentage (0-100)
  rolloutPercentage: process.env.IMAGE_PROCESSING_ROLLOUT
    ? parseInt(process.env.IMAGE_PROCESSING_ROLLOUT)
    : 0,

  // Worker settings
  maxConcurrentJobs: process.env.IMAGE_PROCESSING_CONCURRENCY
    ? parseInt(process.env.IMAGE_PROCESSING_CONCURRENCY)
    : 3,

  // File limits
  maxFileSize: process.env.IMAGE_PROCESSING_MAX_SIZE
    ? parseInt(process.env.IMAGE_PROCESSING_MAX_SIZE)
    : 50 * 1024 * 1024, // 50MB

  // Storage quotas
  maxUserStorage: process.env.IMAGE_PROCESSING_USER_QUOTA
    ? parseInt(process.env.IMAGE_PROCESSING_USER_QUOTA)
    : 500 * 1024 * 1024 // 500MB
}
```

## Benefits & Impact

### Performance Improvements

- **Page Load Speed**: 40-60% faster image loading with optimized formats
- **Bandwidth Savings**: 50-70% reduction in image data transfer
- **Core Web Vitals**: Improved LCP and CLS scores
- **Mobile Experience**: Better performance on slower connections

### User Experience

- **Immediate Response**: Original images load instantly, variants appear progressively
- **Responsive Images**: Automatically served optimal sizes for each device
- **Fallback Safety**: System works even if processing fails
- **Storage Efficiency**: Reduced storage costs with better compression

### Developer Benefits

- **Simple Integration**: Drop-in replacement for existing upload flows
- **Effect Patterns**: Consistent with existing codebase architecture
- **Type Safety**: Full TypeScript support throughout
- **Monitoring**: Built-in observability and debugging tools

## Future Enhancements

### Phase 2 Features

- **AVIF Support**: Next-generation image format with better compression
- **Smart Cropping**: AI-powered content-aware image cropping
- **Face Detection**: Automatic face-based avatar positioning
- **Color Analysis**: Extract dominant colors for UI theming

### Phase 3 Features

- **Dynamic Resizing**: Real-time image generation via URL parameters
- **CDN Integration**: Direct processing at edge locations
- **Video Thumbnails**: Extract frames from video uploads
- **Batch Processing**: Admin tools for bulk image operations

This implementation provides a robust, scalable image processing solution that integrates seamlessly with the existing GBFM architecture while maintaining the indie development philosophy of pragmatic, incremental improvements.
