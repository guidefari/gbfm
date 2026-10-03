import { Schema } from 'effect'

export const PlayerPreferences = Schema.Struct({
  continueQueue: Schema.Boolean,
  restorePosition: Schema.Boolean,
})

export type PlayerPreferences = typeof PlayerPreferences.Type

export const defaultPlayerPreferences: PlayerPreferences = {
  continueQueue: true,
  restorePosition: true,
}
