import { Badge } from './badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Badge'
}

export function Badges() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Status'
        title='Badge'
        description='Compact status and metadata labels.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Variants</CardTitle>
          <CardDescription>Common content states.</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap gap-2'>
          <Badge>Published</Badge>
          <Badge variant='secondary'>Draft</Badge>
          <Badge variant='outline'>Archived</Badge>
          <Badge variant='destructive'>Failed</Badge>
        </CardContent>
      </Card>
    </div>
  )
}
