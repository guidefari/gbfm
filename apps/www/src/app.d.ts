/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    auth: import('./lib/page').PageAuth
  }
}

declare namespace Cloudflare {
  interface Env {
    API: Fetcher
    SOCIAL_IMAGES: Fetcher
  }
}

declare module 'cloudflare:workers' {
  export const env: Cloudflare.Env
}
