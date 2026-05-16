import { MixesSkeleton, MixesListSkeleton } from './mixes-skeleton'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/MixesSkeleton'
}

export function MixesSkeletons() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Loading'
        title='MixesSkeleton'
        description='Skeleton states for the mixes listing page.'
      />
      <MixesSkeleton />
    </div>
  )
}

export function MixesListSkeletonStory() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Loading'
        title='MixesListSkeleton'
        description='Just the list portion without the page header skeleton.'
      />
      <MixesListSkeleton />
    </div>
  )
}
