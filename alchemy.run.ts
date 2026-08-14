import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import { apiWorker } from './alchemy/api'
import { cdnRouter } from './alchemy/cdn'
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
    const secrets = yield* secretsStore(config.apiUrl)
    const emailConfig = emailDeploymentConfig({
      stage: config.stage,
      testRecipient: process.env.EMAIL_TEST_RECIPIENT,
      localDev: config.isLocalDev
    })

    const email = yield* emailResources(config, emailConfig)
    const store = yield* storage(config)
    const api = yield* apiWorker({ config, store, secrets, email, emailConfig })
    const cdn = yield* cdnRouter(config, store)

    yield* dnsRedirects(config)

    const www = yield* website(config)

    return {
      apiUrl: api.url,
      apiDomains: api.domains,
      cdnRouterUrl: cdn.url,
      cdnRouterDomains: cdn.domains,
      wwwUrl: www.url,
      wwwDomains: www.domains,
      databaseName: store.db.databaseName,
      userContentBucketName: store.userContent.bucketName,
      mixesBucketName: store.mixes.bucketName
    }
  })
)
