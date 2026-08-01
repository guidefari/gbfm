import { ShowsSkeleton } from './shows-skeleton'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Media/Shows skeleton'
}

export function ShowsSkeletons() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Loading'
        title='ShowsSkeleton'
        description='Grid skeleton for the shows browse page.'
      />
      <ShowsSkeleton />
    </div>
  )
}
