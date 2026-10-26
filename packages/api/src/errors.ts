import { Schema } from 'effect'
import { HttpApiError, HttpApiSchema } from 'effect/http-api'

export class MusicServiceUnavailableResponse extends Schema.Error<MusicServiceUnavailableResponse>(
  'MusicServiceUnavailableResponse',
)({
  _tag: Schema.tag('ServiceUnavailable'),
  retryAfterSeconds: Schema.optional(Schema.Number),
}) {}

export const MusicServiceUnavailableHttpError = MusicServiceUnavailableResponse.pipe(
  HttpApiSchema.encodeToWithHeaders(
    {
      body: HttpApiError.ServiceUnavailable,
      headers: { 'retry-after': Schema.optional(Schema.Number) },
    },
    {
      decode: ({ headers }) =>
        new MusicServiceUnavailableResponse({ retryAfterSeconds: headers['retry-after'] }),
      encode: (error) => ({
        body: new HttpApiError.ServiceUnavailable(),
        headers: { 'retry-after': error.retryAfterSeconds },
      }),
    },
  ),
)

export class ReadinessCheckFailedError extends Schema.TaggedError<ReadinessCheckFailedError>()(
  'ReadinessCheckFailedError',
  {
    dbConnected: Schema.Literal(false),
  },
  { httpApiStatus: 500 },
) {}

// No built-in HttpApiError class maps to 413 -- HttpApiError.ts only goes up
// to the common 4xx/5xx set (BadRequest, Unauthorized, ..., ServiceUnavailable),
// none of them 413. The old Hono multipart-init route used
// HttpStatusCodes.REQUEST_TOO_LONG for an oversized fileSize.
export class FileTooLargeError extends Schema.TaggedError<FileTooLargeError>()(
  'FileTooLargeError',
  {
    message: Schema.String,
    maxBytes: Schema.Number,
  },
  { httpApiStatus: 413 },
) {}
