import { domain } from './dns'

export const bucket = new sst.aws.Bucket('MDX_Bucket', {
  access: 'cloudfront'
})

export const contentBucket = new sst.aws.Bucket('User_Content', {
  access: 'cloudfront'
})

// QR PDFs are temporary — expire them via S3 lifecycle instead of a polling cron job
new aws.s3.BucketLifecycleConfigurationV2('QrPdfLifecycle', {
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

export const mixesBucket = new sst.aws.Bucket('Mixes', {
  access: 'cloudfront'
})

export const dbBackupBucket = new sst.aws.Bucket('DatabaseBackups', {
  access: 'cloudfront'
})

export const fileRouter = new sst.aws.Router('Router', {
  domain: {
    name: `cdn.${domain}`,
    dns: sst.cloudflare.dns()
  }
})

// fileRouter.routeBucket("/mdx", bucket);
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
