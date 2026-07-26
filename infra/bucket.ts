import { domain } from './dns'

const isDevStage = $app.stage === 'dev'

// Browser PUTs multipart part bytes directly to this bucket via presigned
// UploadPartCommand URLs (see apps/vps/src/http/upload.handlers.ts's
// presignMultipartPart) -- scoped to the real deployed web origins rather
// than sst.aws.Bucket's own default of allowOrigins: ["*"], since the
// presigned URL itself is the only auth on that PUT.
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
  fileRouter: fileRouter.url
}
