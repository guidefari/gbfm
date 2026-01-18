import { domain } from './dns'
import { secret } from './secret'
import { isLocal } from './stage'
import { vps_gateway } from './vps'

export const www = new sst.aws.StaticSite('gbfm-www', {
  path: './apps/www',
  build: {
    command: 'bun run build',
    output: 'dist'
  },
  environment: {
    VITE_VPS_BASE_URL: isLocal ? 'http://localhost:3003' : vps_gateway.url,
    VITE_PUBLIC_POSTHOG_KEY: secret.POSTHOG_KEY.value,
    VITE_PUBLIC_POSTHOG_HOST: secret.POSTHOG_HOST.value
  },
  domain: {
    name: `www.${domain}`,
    dns: sst.cloudflare.dns(),
    ...($app.stage === 'prod' ? { aliases: [domain] } : {})
  }
})

export const outputs = {
  www: www.url
}
