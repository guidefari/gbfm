import { domain } from './dns'

const isDevStage = $app.stage === 'dev'

export const contentBucket = isDevStage
  ? sst.aws.Bucket.get('User_Content', 'gbfm-prod-usercontentbucket-cohrefob')
  : new sst.aws.Bucket('User_Content', {
      access: 'cloudfront'
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
