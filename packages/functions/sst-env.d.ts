/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
import "sst"
export {}
declare module "sst" {
  export interface Resource {
    "Auth": {
      "publicKey": string
      "type": "sst.aws.Auth"
    }
    "AuthAuthenticator": {
      "name": string
      "type": "sst.aws.Function"
      "url": string
    }
    "AuthWorkerCF": {
      "type": "sst.cloudflare.Worker"
      "url": string
    }
    "Email": {
      "sender": string
      "type": "sst.aws.Email"
    }
    "MDX_Bucket": {
      "name": string
      "type": "sst.aws.Bucket"
    }
    "OpenApi": {
      "name": string
      "type": "sst.aws.Function"
      "url": string
    }
    "OpenApiWorker": {
      "type": "sst.cloudflare.Worker"
      "url": string
    }
    "SpotifyClientId": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "SpotifyClientSecret": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "SquealDBUrl": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "gbfm-www": {
      "type": "sst.aws.StaticSite"
      "url": string
    }
  }
}
