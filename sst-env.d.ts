/* tslint:disable */
/* eslint-disable */
import "sst"
declare module "sst" {
  export interface Resource {
    "OpenApi": {
      "name": string
      "type": "sst.aws.Function"
      "url": string
    }
    "OpenApiWorker": {
      "type": "sst.cloudflare.Worker"
      "url": string
    }
    "gbfm-web": {
      "type": "sst.aws.StaticSite"
      "url": string
    }
  }
}
export {}
