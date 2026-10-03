import { defaultPlayerPreferences, PlayerPreferences } from '@gbfm/player'
import { Option, Schema } from 'effect'

export const preferencesKey = 'gbfm-player-preferences.json'

export const readPlayerPreferences = (storage: () => Pick<Storage, 'getItem'> | undefined) => {
  try {
    return Schema.decodeUnknownOption(Schema.fromJsonString(PlayerPreferences))(
      storage()?.getItem(preferencesKey),
    ).pipe(Option.getOrElse(() => defaultPlayerPreferences))
  } catch {
    return defaultPlayerPreferences
  }
}
