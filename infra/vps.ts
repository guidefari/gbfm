import { contentBucket, fileRouter, mixesBucket } from './bucket'
import { domain, urls } from './dns'
import { email } from './email'
import { allSecrets } from './secret'

const isLocal = ['local', 'dev'].includes($app.stage)

export const vpc = new sst.aws.Vpc('gbfm_network', {
  bastion: !isLocal
  // nat: "ec2",
})

export const cluster = new sst.aws.Cluster('gbfm_cluster', {
  vpc
})

// export const database = new sst.aws.Postgres('gbfm_postgres', {
//   vpc,
//   version: '16.8',
//   dev: {
//     username: 'user-name',
//     password: 'strong-password',
//     database: 'postgres',
//     port: 5432
//   }
// })

export const service = new sst.aws.Service('gbfm_vps', {
  cluster,
  serviceRegistry: {
    port: 3003
  },
  dev: {
    directory: './apps/vps',
    command: 'bun dev'
  },
  image: {
    context: './',
    target: 'release',
    dockerfile: 'apps/vps/Dockerfile'
  },
  link: [
    // database,
    email,
    urls,
    fileRouter,
    contentBucket,
    mixesBucket,
    ...allSecrets
  ],
  capacity: 'spot'
})

export const vps_gateway = new sst.aws.ApiGatewayV2('gbfm_vps_gateway', {
  vpc,
  domain: {
    name: `vps.${domain}`,
    dns: sst.cloudflare.dns()
  }
})

if (!isLocal) {
  vps_gateway.routePrivate('$default', service.nodes.cloudmapService.arn)
}

export const outputs = {
  vps_gateway: vps_gateway.url
}
