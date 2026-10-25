interface CdnRouterBindings {
  readonly USER_CONTENT: R2Bucket
  readonly MIXES: R2Bucket
  readonly IMAGES: ImagesBinding
  readonly MEDIA_PREVIEW_KEY?: string
  readonly MEDIA_PREVIEW_ORIGIN?: string
}

interface Env extends CdnRouterBindings {
  readonly IMAGES: CdnRouterBindings['IMAGES']
}

declare namespace Cloudflare {
  interface Env extends CdnRouterBindings {
    readonly IMAGES: CdnRouterBindings['IMAGES']
  }
}
