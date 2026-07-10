import { Schema } from 'effect'

export class ReadinessCheckFailedError extends Schema.TaggedErrorClass<ReadinessCheckFailedError>()(
  'ReadinessCheckFailedError',
  {
    dbConnected: Schema.Literal(false)
  },
  { httpApiStatus: 500 }
) {}
