import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const Uuid = Schema.String.pipe(Schema.check(Schema.isPattern(UuidPattern)))

const UrlPattern = /^https?:\/\/.+/i
const UrlString = Schema.String.pipe(Schema.check(Schema.isPattern(UrlPattern)))

// Matches zod's z.string().datetime() default (no offset, no local): UTC
// only, 'Z' suffix required, calendar-valid date. Derived from
// zod/src/v4/core/regexes.ts's dateSource/timeSource/datetime() with
// offset=false, local=false, precision=null (fractional seconds optional,
// any length).
const IsoDateTimePattern =
  /^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?Z$/
const IsoDateTimeString = Schema.String.pipe(Schema.check(Schema.isPattern(IsoDateTimePattern)))

const MusicReminderStatus = Schema.Literals(['pending', 'processing', 'sent', 'failed'])

export const MusicReminderResponse = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  musicTitle: Schema.String,
  artistName: Schema.String,
  musicUrl: Schema.String,
  albumCoverUrl: Schema.NullOr(Schema.String),
  reminderDate: Schema.String,
  notes: Schema.NullOr(Schema.String),
  status: MusicReminderStatus,
  isSent: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String
})

export const CreateMusicReminderInput = Schema.Struct({
  musicTitle: Schema.NonEmptyString,
  artistName: Schema.NonEmptyString,
  musicUrl: UrlString,
  albumCoverUrl: Schema.optional(UrlString),
  reminderDate: IsoDateTimeString,
  notes: Schema.optional(Schema.String)
})
export type CreateMusicReminderInput = typeof CreateMusicReminderInput.Type

export const CreateMusicReminderResponse = Schema.Struct({
  success: Schema.Boolean,
  reminder: MusicReminderResponse,
  message: Schema.String
})

export const GetMusicRemindersResponse = Schema.Struct({
  success: Schema.Boolean,
  reminders: Schema.Array(MusicReminderResponse),
  total: Schema.Number
})

export const UpdateMusicReminderInput = Schema.Struct({
  musicTitle: Schema.optional(Schema.NonEmptyString),
  artistName: Schema.optional(Schema.NonEmptyString),
  musicUrl: Schema.optional(UrlString),
  albumCoverUrl: Schema.optional(UrlString),
  reminderDate: Schema.optional(IsoDateTimeString),
  notes: Schema.optional(Schema.String)
})
export type UpdateMusicReminderInput = typeof UpdateMusicReminderInput.Type

export const UpdateMusicReminderResponse = Schema.Struct({
  success: Schema.Boolean,
  reminder: MusicReminderResponse,
  message: Schema.String
})

export const DeleteMusicReminderResponse = Schema.Struct({
  success: Schema.Boolean,
  message: Schema.String
})

export const MusicRemindersGroup = HttpApiGroup.make('music-reminders')
  .add(
    HttpApiEndpoint.post('createMusicReminder', '/api/music-reminders', {
      payload: CreateMusicReminderInput,
      success: CreateMusicReminderResponse,
      error: HttpApiError.BadRequest
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getMusicReminders', '/api/music-reminders', {
      success: GetMusicRemindersResponse
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.put('updateMusicReminder', '/api/music-reminders/:id', {
      params: { id: Uuid },
      payload: UpdateMusicReminderInput,
      success: UpdateMusicReminderResponse,
      error: [HttpApiError.BadRequest, HttpApiError.NotFound, HttpApiError.Forbidden]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.delete('deleteMusicReminder', '/api/music-reminders/:id', {
      params: { id: Uuid },
      success: DeleteMusicReminderResponse,
      error: [HttpApiError.NotFound, HttpApiError.Forbidden]
    }).middleware(AuthMiddleware)
  )
