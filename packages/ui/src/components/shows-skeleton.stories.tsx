import { ShowsSkeleton } from './shows-skeleton'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/ShowsSkeleton'
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
