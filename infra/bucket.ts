import { domain } from './dns'

const isDevStage = $app.stage === 'dev'

// Browser PUTs image bytes (apps/server/src/http/upload.handlers.ts's
// presignImage) and audio multipart part bytes directly to this bucket via
// presigned URLs -- scoped to the real deployed web origins rather than
// sst.aws.Bucket's own default of allowOrigins: ["*"], since the presigned
// URL itself is the only auth on that PUT.
const contentBucketCorsOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'https://www.goosebumps.fm',
  'https://goosebumps.fm',
  `https://${domain}`
]

export const contentBucket = isDevStage
  ? sst.aws.Bucket.get('User_Content', 'gbfm-prod-usercontentbucket-cohrefob')
  : new sst.aws.Bucket('User_Content', {
      access: 'cloudfront',
      cors: {
        allowOrigins: contentBucketCorsOrigins,
        allowMethods: ['PUT'],
        allowHeaders: ['*'],
        exposeHeaders: ['ETag'],
        maxAge: '1 hour'
      }
    })

// QR PDFs are temporary — expire them via S3 lifecycle instead of a polling cron job
new aws.s3.BucketLifecycleConfiguration('QrPdfLifecycle', {
  bucket: contentBucket.name,
  rules: [
    {
      id: 'expire-qr-pdfs',
      status: 'Enabled',
      filter: { prefix: 'qr-pdfs/' },
      expiration: { days: 1 }
    },
    {
      id: 'abort-incomplete-multipart-uploads',
      status: 'Enabled',
      filter: { prefix: '' },
      abortIncompleteMultipartUpload: { daysAfterInitiation: 1 }
    }
  ]
})

export const mixesBucket = isDevStage
  ? sst.aws.Bucket.get('Mixes', 'gbfm-prod-mixesbucket-zftkfrfx')
  : new sst.aws.Bucket('Mixes', {
      access: 'cloudfront'
    })

const r2BucketNamePrefix = $app.stage === 'prod' ? 'gbfm' : `gbfm-${$app.stage}`

export const userContentR2Bucket = new sst.cloudflare.Bucket('UserContentR2', {
  transform: {
    bucket: {
      name: `${r2BucketNamePrefix}-user-content`
    }
  }
})

export const mixesR2Bucket = new sst.cloudflare.Bucket('MixesR2', {
  transform: {
    bucket: {
      name: `${r2BucketNamePrefix}-mixes`
    }
  }
})

export const cdnRouterWorker = new sst.cloudflare.Worker('CdnRouterWorker', {
  handler: 'workers/cdn-router/src/index.ts',
  domain: `r2-cdn.${domain}`,
  transform: {
    worker: (args) => {
      args.bindings = $resolve([args.bindings, userContentR2Bucket.name, mixesR2Bucket.name]).apply(
        ([bindings, userContentBucketName, mixesBucketName]) => [
          ...(bindings ?? []),
          {
            type: 'r2_bucket',
            name: 'USER_CONTENT',
            bucketName: userContentBucketName
          },
          {
            type: 'r2_bucket',
            name: 'MIXES',
            bucketName: mixesBucketName
          }
        ]
      )
    }
  }
})

// Retain the retired backup bucket until its 30-day lifecycle empties it. It is deliberately
// not linked to compute; remove this declaration only after the bucket is confirmed empty.
export const dbBackupBucket = isDevStage
  ? sst.aws.Bucket.get('DatabaseBackups', 'gbfm-prod-databasebackupsbucket-xbxkwmwo')
  : new sst.aws.Bucket('DatabaseBackups', {
      access: 'cloudfront',
      transform: {
        bucket: {
          lifecycleRules: [
            {
              id: 'expire-old-backups',
              enabled: true,
              expiration: { days: 30 }
            }
          ]
        }
      }
    })

export const fileRouter = new sst.aws.Router('Router', {
  domain: {
    name: `cdn.${domain}`,
    dns: sst.cloudflare.dns()
  }
})

fileRouter.routeBucket('/user-content', contentBucket, {
  rewrite: {
    regex: '^/user-content/(.*)$',
    to: '/$1'
  }
})
fileRouter.routeBucket('/mixes', mixesBucket, {
  rewrite: {
    regex: '^/mixes/(.*)$',
    to: '/$1'
  }
})

export const outputs = {
  fileRouter: fileRouter.url,
  cdnRouterTestUrl: cdnRouterWorker.url,
  userContentR2Bucket: userContentR2Bucket.name,
  mixesR2Bucket: mixesR2Bucket.name
}
