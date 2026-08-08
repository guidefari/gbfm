import { contentBucket, dbBackupBucket, fileRouter, mixesBucket } from './bucket'
import { domain, urls } from './dns'
import { email } from './email'
import { allSecrets, secret } from './secret'

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
  environment: {
    SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? ''
  },
  link: [
    // database,
    email,
    urls,
    fileRouter,
    contentBucket,
    mixesBucket,
    dbBackupBucket,
    ...allSecrets
  ],
  capacity: 'spot'
})

// disabling cors on gateway and handling via app instead.
// Sources:
// - https://sst.dev/docs/component/aws/apigatewayv2/
// - https://www.dpklabs.com/blog/avoiding-cors-issues-with-hono-sst-and-api-gateway
export const vps_gateway = new sst.aws.ApiGatewayV2('gbfm_vps_gateway', {
  vpc,
  cors: {
    allowOrigins: [`https://${domain}`, `https://www.${domain}`],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'Refresh-Token',
      'sentry-trace',
      'baggage',
      'b3',
      'traceparent'
    ],
    exposeHeaders: ['Set-Cookie'],
    allowCredentials: true
  },
  domain: {
    name: `vps.${domain}`,
    dns: sst.cloudflare.dns()
  }
})

if (!isLocal) {
  vps_gateway.routePrivate('$default', service.nodes.cloudmapService.arn)
}

export const dbBackupTask = new sst.aws.Task('DatabaseBackupTask', {
  cluster,
  image: {
    context: './',
    target: 'backup-task',
    dockerfile: 'apps/vps/Dockerfile'
  },
  environment: {
    SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? '',
    DATABASE_BACKUP_BUCKET: dbBackupBucket.name,
    DatabaseHost: secret.DatabaseHost.value,
    DatabaseUser: secret.DatabaseUser.value,
    DatabasePassword: secret.DatabasePassword.value,
    DatabasePort: secret.DatabasePort.value,
    DatabaseName: secret.DatabaseName.value
  },
  link: [dbBackupBucket, ...allSecrets]
})

export const blueskySyncTask = new sst.aws.Task('BlueskySyncTask', {
  cluster,
  image: {
    context: './',
    target: 'bluesky-sync-task',
    dockerfile: 'apps/vps/Dockerfile'
  },
  link: [...allSecrets]
})

export const outputs = {
  vps_gateway: vps_gateway.url
}
