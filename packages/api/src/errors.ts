import { Schema } from 'effect'

export class ReadinessCheckFailedError extends Schema.TaggedError<ReadinessCheckFailedError>()(
  'ReadinessCheckFailedError',
  {
    dbConnected: Schema.Literal(false)
  },
  { httpApiStatus: 500 }
) {}

// No built-in HttpApiError class maps to 413 -- HttpApiError.ts only goes up
// to the common 4xx/5xx set (BadRequest, Unauthorized, ..., ServiceUnavailable),
// none of them 413. The old Hono multipart-init route used
// HttpStatusCodes.REQUEST_TOO_LONG for an oversized fileSize.
export class FileTooLargeError extends Schema.TaggedError<FileTooLargeError>()(
  'FileTooLargeError',
  {
    message: Schema.String,
    maxBytes: Schema.Number
  },
  { httpApiStatus: 413 }
) {}
