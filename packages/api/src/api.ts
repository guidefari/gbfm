import { HttpApi } from 'effect/unstable/httpapi'
import { AdminGroup } from './admin'
import { AudioGroup } from './audio'
import { EmailGroup } from './email'
import { FavoritesGroup } from './favorites'
import { FileManagerGroup } from './file-manager'
import { HealthGroup } from './health'
import { InternalGroup } from './internal'
import { InviteGroup } from './invite'
import { MusicGroup } from './music'
import { MusicRemindersGroup } from './music-reminders'
import { NavigationGroup } from './navigation'
import { NewsletterGroup } from './newsletter'
import { PostGroup } from './post'
import { ProfileGroup } from './profile'
import { ReleaseGroup } from './release'
import { ResolveGroup } from './resolve'
import { SearchGroup } from './search'
import { SiteMetadataGroup } from './site-metadata'
import { ShowsGroup } from './shows'
import { SpotifyGroup } from './spotify'
import { TelemetryGroup } from './telemetry'
import { UploadGroup } from './upload'
import { UserGroup } from './user'

export const Api = HttpApi.make('gbfm')
  .add(HealthGroup)
  .add(InternalGroup)
  .add(MusicGroup)
  .add(SearchGroup)
  .add(SiteMetadataGroup)
  .add(ProfileGroup)
  .add(ResolveGroup)
  .add(AdminGroup)
  .add(InviteGroup)
  .add(ReleaseGroup)
  .add(PostGroup)
  .add(AudioGroup)
  .add(EmailGroup)
  .add(FavoritesGroup)
  .add(MusicRemindersGroup)
  .add(NavigationGroup)
  .add(NewsletterGroup)
  .add(FileManagerGroup)
  .add(SpotifyGroup)
  .add(TelemetryGroup)
  .add(ShowsGroup)
  .add(UserGroup)
  .add(UploadGroup)
