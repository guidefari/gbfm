import { Button } from './button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Button'
}

export function Buttons() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Actions'
        title='Buttons'
        description='Primary actions stay punchy while secondary controls recede.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Variants</CardTitle>
          <CardDescription>Hover, focus, active, and disabled states.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div className='flex flex-wrap gap-3'>
            <Button>Default</Button>
            <Button variant='secondary'>Secondary</Button>
            <Button variant='outline'>Outline</Button>
            <Button variant='ghost'>Ghost</Button>
            <Button variant='link'>Link</Button>
            <Button variant='destructive'>Destructive</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <Button size='sm'>Small</Button>
            <Button>Default</Button>
            <Button size='lg'>Large</Button>
            <Button size='icon' aria-label='Play'>
              Play
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
