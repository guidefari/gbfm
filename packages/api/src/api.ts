import { HttpApi } from 'effect/unstable/httpapi'
import { AdminGroup } from './admin'
import { HealthGroup } from './health'
import { InternalGroup } from './internal'
import { InviteGroup } from './invite'
import { MusicGroup } from './music'
import { ProfileGroup } from './profile'
import { ResolveGroup } from './resolve'
import { SearchGroup } from './search'

export const Api = HttpApi.make('gbfm')
  .add(HealthGroup)
  .add(InternalGroup)
  .add(MusicGroup)
  .add(SearchGroup)
  .add(ProfileGroup)
  .add(ResolveGroup)
  .add(AdminGroup)
  .add(InviteGroup)
