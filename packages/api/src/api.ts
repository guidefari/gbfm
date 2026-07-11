import { HttpApi } from 'effect/unstable/httpapi'
import { HealthGroup } from './health'
import { InternalGroup } from './internal'
import { MusicGroup } from './music'
import { SearchGroup } from './search'

export const Api = HttpApi.make('gbfm')
  .add(HealthGroup)
  .add(InternalGroup)
  .add(MusicGroup)
  .add(SearchGroup)
