import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import { apiWorker } from './alchemy/api'
import { cdnRouter } from './alchemy/cdn'
import { deploymentConfig } from './alchemy/config'
import { dnsRedirects } from './alchemy/dns'
import { emailResources } from './alchemy/email'
import { secretsStore } from './alchemy/secrets'
import { stageConfig } from './alchemy/stage'
import { storage } from './alchemy/storage'
import { website } from './alchemy/www'
import { emailDeploymentConfig } from './apps/server/src/email-deployment-config'

export default Alchemy.Stack(
  'gbfm',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const config = yield* stageConfig
    const deployment = yield* deploymentConfig(config.isLocalDev)
    const secrets = yield* secretsStore(config.apiUrl, config.isLocalDev, deployment.secrets)
    const emailConfig = emailDeploymentConfig({
      stage: config.stage,
      testRecipient: deployment.emailTestRecipient,
      localDev: config.isLocalDev
    })

    const email = yield* emailResources(config, emailConfig)
    const store = yield* storage(config)
    const cdn = yield* cdnRouter(config, store)
    const api = yield* apiWorker({
      config,
      store,
      secrets,
      email,
      emailConfig,
      cdn,
      adminEmail: deployment.adminEmail
    })

    yield* dnsRedirects(config)

    const www = yield* website({
      config,
      websiteConfig: deployment.website,
      apiUrl: api.url
    })

    return {
      apiUrl: api.url,
      apiDomains: api.urls,
      cdnRouterUrl: cdn.url,
      cdnRouterDomains: cdn.urls,
      wwwUrl: www.url,
      wwwDomains: www.urls,
      databaseName: store.db.databaseName,
      userContentBucketName: store.userContent.bucketName,
      mixesBucketName: store.mixes.bucketName
    }
  })
)
