import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Skeleton } from './skeleton'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Skeleton'
}

export function Skeletons() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Loading'
        title='Skeleton'
        description='Placeholder rhythm for media-heavy views.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Loading state</CardTitle>
          <CardDescription>Stacked placeholder example.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Skeleton className='h-40 w-full' />
          <Skeleton className='h-4 w-3/4' />
          <Skeleton className='h-4 w-1/2' />
        </CardContent>
      </Card>
    </div>
  )
}
