import { HttpApi } from 'effect/unstable/httpapi'
import { AdminGroup } from './admin'
import { FavoritesGroup } from './favorites'
import { FileManagerGroup } from './file-manager'
import { HealthGroup } from './health'
import { InternalGroup } from './internal'
import { InviteGroup } from './invite'
import { MusicGroup } from './music'
import { NewsletterGroup } from './newsletter'
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
  .add(FavoritesGroup)
  .add(NewsletterGroup)
  .add(FileManagerGroup)
