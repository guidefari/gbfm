import { domain } from './dns'

export const bucket = new sst.aws.Bucket('MDX_Bucket', {
  access: 'cloudfront'
})

export const contentBucket = new sst.aws.Bucket('User_Content', {
  access: 'cloudfront'
})

export const mixesBucket = new sst.aws.Bucket('Mixes', {
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
