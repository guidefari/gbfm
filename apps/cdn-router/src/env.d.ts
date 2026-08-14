interface CdnRouterBindings {
  readonly USER_CONTENT: R2Bucket
  readonly MIXES: R2Bucket
}

interface Env extends CdnRouterBindings {}

declare namespace Cloudflare {
  interface Env extends CdnRouterBindings {}
}
