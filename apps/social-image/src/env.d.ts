import type { SocialImageEnv } from './worker'

declare global {
  namespace Cloudflare {
    interface Env extends SocialImageEnv {
      readonly ASSETS: SocialImageEnv['ASSETS']
    }
  }
}
