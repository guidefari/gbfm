import { Badge } from './badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Primitives/Badge'
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
          <Badge variant='success'>Live</Badge>
          <Badge variant='warning'>Pending</Badge>
          <Badge variant='destructive'>Failed</Badge>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Hierarchy</CardTitle>
          <CardDescription>
            Only destructive carries a solid fill, so urgent states stay louder than passive ones.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <div className='flex items-center gap-2'>
            <Badge variant='destructive'>Upload failed</Badge>
            <span className='text-sm text-muted-foreground'>needs attention now</span>
          </div>
          <div className='flex items-center gap-2'>
            <Badge>Published</Badge>
            <span className='text-sm text-muted-foreground'>informational</span>
          </div>
          <div className='flex items-center gap-2'>
            <Badge variant='outline'>Archived</Badge>
            <span className='text-sm text-muted-foreground'>inactive</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
