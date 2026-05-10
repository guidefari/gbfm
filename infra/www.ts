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
    VITE_VPS_BASE_URL: isLocal ? 'http://127.0.0.1:3003' : vps_gateway.url,
    VITE_PUBLIC_SENTRY_DSN: secret.VITE_PUBLIC_SENTRY_DSN.value,
    VITE_PUBLIC_SENTRY_ENVIRONMENT: $app.stage,
    VITE_SPOTIFY_CLIENT_ID: secret.SpotifyClientId.value
  },
  domain: {
    name: `www.${domain}`,
    dns: sst.cloudflare.dns({ proxy: true }),
    ...($app.stage === 'prod' ? { aliases: [domain] } : {})
  }
})

export const outputs = {
  www: www.url
}
