import { Schema } from 'effect'

/** API response for the authenticated listener's email preferences. */
export const EmailPreferences = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  mixReleaseEnabled: Schema.Boolean,
  promotionalEnabled: Schema.Boolean,
  systemEnabled: Schema.Boolean,
  globalUnsubscribe: Schema.Boolean,
  unsubscribeToken: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

/** Editable email preference fields. */
export type EmailPreferenceValues = Pick<
  typeof EmailPreferences.Type,
  'mixReleaseEnabled' | 'promotionalEnabled' | 'systemEnabled' | 'globalUnsubscribe'
>
