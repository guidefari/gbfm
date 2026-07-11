import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

export const S3Object = Schema.Struct({
  key: Schema.String,
  lastModified: Schema.String,
  size: Schema.Number
})

export const GetConfigResponse = Schema.Struct({
  stage: Schema.String,
  bucketRouterUrl: Schema.String,
  buckets: Schema.Struct({
    userContent: Schema.String,
    mixes: Schema.String
  }),
  availableBuckets: Schema.Array(Schema.String)
})

export const ListObjectsResponse = Schema.Struct({
  objects: Schema.Array(S3Object)
})

const ListObjectsQuery = {
  bucketName: Schema.NonEmptyString,
  prefix: Schema.optional(Schema.String)
}

export const CopyObjectInput = Schema.Struct({
  key: Schema.NonEmptyString,
  sourceBucket: Schema.NonEmptyString,
  destinationBucket: Schema.NonEmptyString
})
export type CopyObjectInput = typeof CopyObjectInput.Type

export const CopyObjectResponse = Schema.Struct({
  key: Schema.String
})

export const FileManagerGroup = HttpApiGroup.make('fileManager')
  .add(
    HttpApiEndpoint.get('getFileManagerConfig', '/api/file-manager/config', {
      success: GetConfigResponse,
      error: HttpApiError.Forbidden
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('listFileManagerObjects', '/api/file-manager/list', {
      query: ListObjectsQuery,
      success: ListObjectsResponse,
      error: [HttpApiError.Forbidden, HttpApiError.BadRequest, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.post('copyFileManagerObject', '/api/file-manager/copy', {
      payload: CopyObjectInput,
      success: CopyObjectResponse,
      error: [HttpApiError.Forbidden, HttpApiError.BadRequest, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
